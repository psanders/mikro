/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Persisted WhatsApp CX transcripts (issue #299): the agents' write/read path,
 * the application panel's conversation, the ctl export filters and the
 * per-phone delete.
 */
import { expect } from "chai";
import { appRouter } from "../../src/trpc/index.js";
import type { Context } from "../../src/trpc/context.js";
import {
  createRecordConversationTurn,
  createGetConversationHistory,
  CX_HISTORY_TURNS,
  CX_HISTORY_MAX_AGE_MS,
  PANEL_TURNS
} from "../../src/api/conversations/index.js";
import { createTestDb, applySchema, createAuthenticatedCaller, type TestDb } from "./setup.js";

const PHONE = "+18095551234";

describe("Conversation transcripts Integration", () => {
  let db: TestDb;
  let record: ReturnType<typeof createRecordConversationTurn>;
  let history: ReturnType<typeof createGetConversationHistory>;

  before(async () => {
    db = createTestDb();
    await applySchema(db);
  });

  beforeEach(async () => {
    await db.conversationTurn.deleteMany();
    await db.conversationHandoff.deleteMany();
    await db.loanApplication.deleteMany();
    record = createRecordConversationTurn(db as any);
    history = createGetConversationHistory(db as any);
  });

  after(async () => {
    await db.$disconnect();
  });

  async function makeApplication(phone = PHONE) {
    return db.loanApplication.create({
      data: {
        sessionId: `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        status: "RECEIVED",
        source: "WHATSAPP",
        firstName: "Yokasta",
        lastName: "Díaz",
        phone,
        idNumber: "031-0567812-4",
        homeAddress: "Calle 2",
        rawData: {} as any
      }
    });
  }

  function callerAs(roles: Array<"ADMIN" | "COLLECTOR" | "REVIEWER">) {
    const ctx: Context = {
      db: db as any,
      isAuthenticated: true,
      userId: "00000000-0000-4000-8000-000000000009",
      roles
    };
    return appRouter.createCaller(ctx);
  }

  describe("record + history (agent memory)", () => {
    it("stores a turn with tool calls and reads it back in LLM shape", async () => {
      await record({
        phone: PHONE,
        role: "INBOUND",
        content: "¿cuánto debo?",
        profile: "CUSTOMER"
      });
      await record({
        phone: PHONE,
        role: "AGENT",
        content: "Debes 1,500",
        profile: "CUSTOMER",
        agentName: "carmen",
        agentVersion: "abc123def456",
        toolCalls: [{ name: "getBalance", args: { loanId: 10034 } }]
      });

      const read = await history({ phone: PHONE, scope: "cx" });
      expect(
        read.map(({ role, content, tools_executed }) => ({
          role,
          content,
          ...(tools_executed ? { tools_executed } : {})
        }))
      ).to.deep.equal([
        { role: "user", content: "¿cuánto debo?" },
        {
          role: "assistant",
          content: "Debes 1,500",
          tools_executed: [{ name: "getBalance", args: { loanId: 10034 } }]
        }
      ]);
      // The stored time comes along so the agents can tell a new session.
      expect(read[1].timestamp).to.be.instanceOf(Date);
    });

    it("reads only turns stored before the current one (overlapping messages)", async () => {
      await record({ phone: PHONE, role: "INBOUND", content: "antes", profile: "GUEST" });
      const current = await record({
        phone: PHONE,
        role: "INBOUND",
        content: "hola",
        profile: "GUEST"
      });
      // A second message from the same phone, stored while "hola" is answered.
      await record({ phone: PHONE, role: "INBOUND", content: "después", profile: "GUEST" });

      const read = await history({ phone: PHONE, scope: "cx", excludeId: current.id });
      expect(read.map((m) => m.content)).to.deep.equal(["antes"]);
    });

    it("leaves failed sends out of the agent's memory but keeps them for audits", async () => {
      await record({ phone: PHONE, role: "INBOUND", content: "hola", profile: "GUEST" });
      await record({
        phone: PHONE,
        role: "AGENT",
        content: "nunca llegó",
        profile: "GUEST",
        failed: true
      });

      expect((await history({ phone: PHONE, scope: "cx" })).map((m) => m.content)).to.deep.equal([
        "hola"
      ]);
      const exported = await createAuthenticatedCaller(db).listConversationTurns({ phone: PHONE });
      expect(exported.map((t) => [t.content, t.failed])).to.deep.equal([
        ["hola", false],
        ["nunca llegó", true]
      ]);
    });

    it("starts José's memory at the application's last reopen", async () => {
      const app = await makeApplication();
      const prospect = { phone: PHONE, profile: "PROSPECT" as const, applicationId: app.id };
      await db.conversationTurn.createMany({
        data: [
          {
            ...prospect,
            role: "INBOUND",
            content: "intake viejo",
            createdAt: new Date(Date.now() - 3_600_000)
          },
          {
            ...prospect,
            role: "AGENT",
            content: "pregunta vieja",
            createdAt: new Date(Date.now() - 3_599_000)
          }
        ]
      });
      await db.loanApplication.update({
        where: { id: app.id },
        data: { reopenedAt: new Date(Date.now() - 60_000) }
      });
      await record({ ...prospect, role: "INBOUND", content: "volví" });
      await record({ ...prospect, role: "AGENT", content: "¡Bienvenida de vuelta!" });

      const jose = await history({ phone: PHONE, scope: "prospect", applicationId: app.id });
      expect(jose.map((m) => m.content)).to.deep.equal(["volví", "¡Bienvenida de vuelta!"]);
    });

    it("normalizes the phone to E.164 on write and read", async () => {
      await record({ phone: "18095551234", role: "INBOUND", content: "hola", profile: "GUEST" });

      const row = await db.conversationTurn.findFirstOrThrow();
      expect(row.phone).to.equal(PHONE);
      expect(await history({ phone: "18095551234", scope: "cx" })).to.have.length(1);
    });

    it("leaves out the current message; José keeps his intake, the CX thread sees it all", async () => {
      const app = await makeApplication();
      await record({ phone: PHONE, role: "INBOUND", content: "requisitos?", profile: "GUEST" });
      await record({
        phone: PHONE,
        role: "INBOUND",
        content: "vendo 50 mil",
        profile: "PROSPECT",
        applicationId: app.id
      });
      await record({
        phone: PHONE,
        role: "AGENT",
        content: "Anotado",
        profile: "PROSPECT",
        applicationId: app.id,
        toolCalls: [{ name: "saveAnswer", args: {} }]
      });
      await record({
        phone: PHONE,
        role: "SYSTEM",
        content: "Ya le avisé al equipo",
        profile: "PROSPECT",
        applicationId: app.id
      });
      const current = await record({
        phone: PHONE,
        role: "INBOUND",
        content: "¿y ahora?",
        profile: "PROSPECT",
        applicationId: app.id
      });

      const jose = await history({
        phone: PHONE,
        scope: "prospect",
        applicationId: app.id,
        excludeId: current.id
      });
      expect(jose.map((m) => m.content)).to.deep.equal(["vendo 50 mil", "Anotado"]);

      // The applicant agent picks up after José's intake instead of greeting again.
      const cx = await history({ phone: PHONE, scope: "cx", excludeId: current.id });
      expect(cx.map((m) => m.content)).to.deep.equal([
        "requisitos?",
        "vendo 50 mil",
        "Anotado",
        "Ya le avisé al equipo"
      ]);
    });

    it("keeps only the latest turns inside the window for the CX thread", async () => {
      const old = new Date(Date.now() - CX_HISTORY_MAX_AGE_MS - 60_000);
      await db.conversationTurn.create({
        data: {
          phone: PHONE,
          role: "INBOUND",
          content: "muy viejo",
          profile: "GUEST",
          createdAt: old
        }
      });
      for (let i = 0; i < CX_HISTORY_TURNS + 5; i++) {
        await db.conversationTurn.create({
          data: {
            phone: PHONE,
            role: "INBOUND",
            content: `m${i}`,
            profile: "GUEST",
            createdAt: new Date(Date.now() - (CX_HISTORY_TURNS + 5 - i) * 1000)
          }
        });
      }

      const cx = await history({ phone: PHONE, scope: "cx" });
      expect(cx).to.have.length(CX_HISTORY_TURNS);
      expect(cx[0].content).to.equal("m5");
      expect(cx.at(-1)?.content).to.equal(`m${CX_HISTORY_TURNS + 4}`);
    });
  });

  describe("getApplicationConversation", () => {
    it("returns every turn for the applicant's phone, including before the application existed", async () => {
      await record({ phone: PHONE, role: "INBOUND", content: "¿requisitos?", profile: "GUEST" });
      const app = await makeApplication();
      await record({
        phone: PHONE,
        role: "AGENT",
        content: "¡Hola! Soy José",
        profile: "PROSPECT",
        agentName: "jose",
        applicationId: app.id
      });
      await record({ phone: "+18095550000", role: "INBOUND", content: "otra persona" });
      await db.conversationHandoff.create({
        data: {
          phone: PHONE,
          profile: "APPLICANT",
          reason: "Pidió hablar con una persona",
          expiresAt: new Date(Date.now() + 1000)
        }
      });

      const result = await callerAs(["REVIEWER"]).getApplicationConversation({
        applicationId: app.id
      });

      expect(result.phone).to.equal(PHONE);
      expect(result.turns.map((t) => t.content)).to.deep.equal(["¿requisitos?", "¡Hola! Soy José"]);
      expect(result.turns[1]).to.include({ role: "AGENT", agentName: "jose" });
      expect(result.handoffs).to.have.length(1);
      expect(result.handoffs[0].reason).to.equal("Pidió hablar con una persona");
      // The Chatwoot link is its own read; unconfigured in the test fixture.
      const link = await callerAs(["REVIEWER"]).getApplicationChatwootUrl({
        applicationId: app.id
      });
      expect(link).to.deep.equal({ url: null });
    });

    it("drops hand-offs older than the oldest turn shown when the thread is truncated", async () => {
      const app = await makeApplication();
      const start = Date.now() - (PANEL_TURNS + 100) * 1000;
      await db.conversationHandoff.create({
        data: {
          phone: PHONE,
          profile: "CUSTOMER",
          reason: "vieja",
          openedAt: new Date(start - 60_000),
          expiresAt: new Date(start)
        }
      });
      await db.conversationTurn.createMany({
        data: Array.from({ length: PANEL_TURNS + 10 }, (_, i) => ({
          phone: PHONE,
          role: "INBOUND",
          content: `m${i}`,
          createdAt: new Date(start + i * 1000)
        }))
      });
      await db.conversationHandoff.create({
        data: {
          phone: PHONE,
          profile: "CUSTOMER",
          reason: "reciente",
          openedAt: new Date(start + (PANEL_TURNS + 5) * 1000),
          expiresAt: new Date(Date.now() + 1000)
        }
      });

      const result = await callerAs(["ADMIN"]).getApplicationConversation({
        applicationId: app.id
      });

      expect(result.turns).to.have.length(PANEL_TURNS);
      expect(result.turns[0].content).to.equal("m10");
      expect(result.handoffs.map((h) => h.reason)).to.deep.equal(["reciente"]);
    });

    it("is empty for an application without a phone", async () => {
      const app = await db.loanApplication.create({
        data: { sessionId: `sess-nophone-${Date.now()}`, status: "DRAFT", rawData: {} as any }
      });

      const result = await callerAs(["ADMIN"]).getApplicationConversation({
        applicationId: app.id
      });

      expect(result).to.deep.include({ phone: null, turns: [], handoffs: [] });
    });

    it("is closed to collectors", async () => {
      const app = await makeApplication();
      let error: unknown;
      try {
        await callerAs(["COLLECTOR"]).getApplicationConversation({ applicationId: app.id });
      } catch (e) {
        error = e;
      }
      expect((error as { code?: string })?.code).to.equal("FORBIDDEN");
    });
  });

  describe("listConversationTurns (ctl export)", () => {
    beforeEach(async () => {
      await record({
        phone: PHONE,
        role: "AGENT",
        content: "a",
        profile: "CUSTOMER",
        agentName: "carmen",
        agentVersion: "v1"
      });
      await record({
        phone: PHONE,
        role: "AGENT",
        content: "b",
        profile: "CUSTOMER",
        agentName: "carmen",
        agentVersion: "v2"
      });
      await record({ phone: "+18095550000", role: "INBOUND", content: "c", profile: "GUEST" });
    });

    it("filters by agent version, profile and phone, oldest first", async () => {
      const caller = createAuthenticatedCaller(db);

      const v2 = await caller.listConversationTurns({ agentVersion: "v2" });
      expect(v2.map((t) => t.content)).to.deep.equal(["b"]);

      const customers = await caller.listConversationTurns({ profile: "CUSTOMER" });
      expect(customers.map((t) => t.content)).to.deep.equal(["a", "b"]);

      const guest = await caller.listConversationTurns({ phone: "18095550000" });
      expect(guest.map((t) => t.content)).to.deep.equal(["c"]);
    });

    it("filters by date range", async () => {
      const caller = createAuthenticatedCaller(db);
      const future = new Date(Date.now() + 60_000);

      expect(await caller.listConversationTurns({ since: future })).to.deep.equal([]);
      expect(await caller.listConversationTurns({ until: future })).to.have.length(3);
    });

    it("is ADMIN only", async () => {
      let error: unknown;
      try {
        await callerAs(["REVIEWER"]).listConversationTurns({});
      } catch (e) {
        error = e;
      }
      expect((error as { code?: string })?.code).to.equal("FORBIDDEN");
    });
  });

  describe("deleteConversation", () => {
    it("removes every turn for the phone and nothing else", async () => {
      await record({ phone: PHONE, role: "INBOUND", content: "a" });
      await record({ phone: PHONE, role: "AGENT", content: "b" });
      await record({ phone: "+18095550000", role: "INBOUND", content: "c" });

      const result = await createAuthenticatedCaller(db).deleteConversation({
        phone: "18095551234"
      });

      expect(result.deleted).to.equal(2);
      const left = await db.conversationTurn.findMany();
      expect(left.map((t) => t.content)).to.deep.equal(["c"]);
    });
  });
});
