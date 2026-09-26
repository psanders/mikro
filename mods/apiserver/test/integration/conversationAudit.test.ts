/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Conversation audit (openspec add-conversation-audit): the run's window
 * watermark, the single-run lock, persisted runs/findings, the
 * `conversation.audited` feed event, and the detail query.
 */
import { expect } from "chai";
import type { JudgeConversation } from "@mikro/agents";
import { appRouter } from "../../src/trpc/index.js";
import type { Context } from "../../src/trpc/context.js";
import {
  createRunConversationAudit,
  AuditInProgressError,
  AUDIT_STALE_RUN_MS
} from "../../src/api/conversations/index.js";
import { createTestDb, applySchema, type TestDb } from "./setup.js";

const PHONE = "+18095551001";
const OTHER = "+18295552044";

describe("Conversation audit Integration", () => {
  let db: TestDb;
  let judgeCalls: string[];
  let judge: JudgeConversation;

  const policies = [
    { id: "no_puntaje", rule: "No revela el puntaje.", severity: "critical" as const }
  ];

  function makeRun(maxConversations = 200) {
    return createRunConversationAudit(db as any, {
      judge: (c, a) => judge(c, a),
      getAgent: (name) => (name === "sofia" ? { name, policies } : undefined),
      getMaxConversations: () => maxConversations
    });
  }

  async function turn(data: {
    phone?: string;
    role: "INBOUND" | "AGENT" | "SYSTEM";
    content: string;
    failed?: boolean;
    applicationId?: string;
    agentName?: string;
  }) {
    return db.conversationTurn.create({
      data: {
        phone: data.phone ?? PHONE,
        role: data.role,
        content: data.content,
        profile: "APPLICANT",
        agentName: data.role === "AGENT" ? (data.agentName ?? "sofia") : null,
        agentVersion: data.role === "AGENT" ? "abc123def456" : null,
        applicationId: data.applicationId ?? null,
        failed: data.failed ?? false
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

  before(async () => {
    db = createTestDb();
    await applySchema(db);
  });

  beforeEach(async () => {
    await db.conversationAuditFinding.deleteMany();
    await db.conversationAuditRun.deleteMany();
    await db.conversationTurn.deleteMany();
    await db.conversationHandoff.deleteMany();
    await db.businessEvent.deleteMany();
    await db.loanApplication.deleteMany();
    judgeCalls = [];
    judge = async (c) => {
      judgeCalls.push(c.phone);
      return [];
    };
  });

  after(async () => {
    await db.$disconnect();
  });

  it("stores the run and its findings and posts the feed card", async () => {
    const app = await db.loanApplication.create({
      data: {
        sessionId: "sess-audit-1",
        status: "RECEIVED",
        source: "WHATSAPP",
        firstName: "Yokasta",
        lastName: "Medina",
        phone: PHONE,
        rawData: {} as any
      }
    });
    await turn({ role: "INBOUND", content: "¿cómo va mi solicitud?", applicationId: app.id });
    const leak = await turn({
      role: "AGENT",
      content: "Tu puntaje Mikro es 74, vas bien.",
      applicationId: app.id
    });
    await turn({ phone: OTHER, role: "AGENT", content: "Listo", failed: true });

    judge = async (c) => {
      judgeCalls.push(c.phone);
      return c.phone === PHONE
        ? [
            {
              policyId: "no_puntaje",
              pass: false,
              turnId: leak.id,
              evidence: "Tu puntaje Mikro es 74",
              reason: "Dio el puntaje."
            }
          ]
        : [];
    };

    const result = await makeRun()({ trigger: "SCHEDULED", actorName: "Sistema" });
    expect(result).to.include({
      conversations: 2,
      turns: 3,
      failedSends: 1,
      criticalCount: 2, // regex check + judge
      warningCount: 1
    });

    const run = await db.conversationAuditRun.findUniqueOrThrow({ where: { id: result.runId } });
    expect(run.status).to.equal("DONE");
    expect(run.lastTurnId).to.be.a("number");
    const byAgent = JSON.parse(run.byAgent);
    expect(byAgent[0]).to.include({
      agentName: "sofia",
      agentVersion: "abc123def456",
      critical: 2
    });

    const findings = await db.conversationAuditFinding.findMany({ where: { runId: result.runId } });
    expect(findings.map((f) => `${f.source}:${f.checkId}`).sort()).to.deep.equal([
      "CODE:failed_send",
      "CODE:sensitive_score",
      "JUDGE:no_puntaje"
    ]);

    const [event] = await db.businessEvent.findMany({ where: { type: "conversation.audited" } });
    expect(event!.actorName).to.equal("Sistema");
    expect(event!.summary).to.equal(
      "Auditoría de conversaciones encontró 3 problemas en 2 conversaciones"
    );
    const payload = JSON.parse(event!.payload);
    expect(payload).to.include({ runId: result.runId, trigger: "SCHEDULED", conversations: 2 });
    expect(payload.topFinding).to.include({
      severity: "CRITICAL",
      personLabel: "Yokasta Medina",
      applicationId: app.id
    });
  });

  it("reviews only turns added since the last completed run", async () => {
    await turn({ role: "INBOUND", content: "hola" });
    await turn({ role: "AGENT", content: "Hola, tu solicitud está en revisión." });
    const first = await makeRun()({ trigger: "SCHEDULED", actorName: "Sistema" });
    expect(first.turns).to.equal(2);

    const second = await makeRun()({ trigger: "SCHEDULED", actorName: "Sistema" });
    expect(second).to.include({ turns: 0, conversations: 0 });

    await turn({ phone: OTHER, role: "INBOUND", content: "buenas" });
    const third = await makeRun()({ trigger: "MANUAL", actorName: "Pedro S." });
    expect(third).to.include({ turns: 1, conversations: 1 });

    const events = await db.businessEvent.findMany({
      where: { type: "conversation.audited" },
      orderBy: { occurredAt: "asc" }
    });
    expect(events).to.have.length(3);
    expect(events[1]!.summary).to.equal(
      "Auditoría de conversaciones sin problemas en 0 conversaciones"
    );
    expect(events[2]!.actorName).to.equal("Pedro S.");
  });

  it("gives the judge earlier turns as context but only cites the window", async () => {
    await turn({ role: "INBOUND", content: "hola" });
    await makeRun()({ trigger: "SCHEDULED", actorName: "Sistema" });
    await turn({ role: "AGENT", content: "Hola de nuevo" });

    let seen: Array<{ context?: boolean }> = [];
    judge = async (c) => {
      seen = c.turns;
      return [];
    };
    await makeRun()({ trigger: "SCHEDULED", actorName: "Sistema" });
    expect(seen.map((t) => !!t.context)).to.deep.equal([true, false]);
  });

  it("rejects a second run while one is in progress", async () => {
    await db.conversationAuditRun.create({
      data: { trigger: "SCHEDULED", actorName: "Sistema", status: "RUNNING" }
    });
    try {
      await makeRun()({ trigger: "MANUAL", actorName: "Pedro S." });
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).to.be.instanceOf(AuditInProgressError);
    }
    expect(await db.conversationAuditRun.count()).to.equal(1);
  });

  it("retires a stale RUNNING run and proceeds", async () => {
    const stale = await db.conversationAuditRun.create({
      data: {
        trigger: "SCHEDULED",
        actorName: "Sistema",
        status: "RUNNING",
        startedAt: new Date(Date.now() - AUDIT_STALE_RUN_MS - 60_000)
      }
    });
    const result = await makeRun()({ trigger: "MANUAL", actorName: "Pedro S." });
    const old = await db.conversationAuditRun.findUniqueOrThrow({ where: { id: stale.id } });
    expect(old.status).to.equal("FAILED");
    const fresh = await db.conversationAuditRun.findUniqueOrThrow({ where: { id: result.runId } });
    expect(fresh.status).to.equal("DONE");
  });

  it("respects maxConversations for the judge", async () => {
    await turn({ phone: PHONE, role: "AGENT", content: "Hola" });
    await turn({ phone: OTHER, role: "AGENT", content: "Hola" });
    const result = await makeRun(1)({ trigger: "SCHEDULED", actorName: "Sistema" });
    expect(result).to.include({ judged: 1, judgeSkipped: 1 });
    expect(judgeCalls).to.have.length(1);
  });

  it("rejects invalid input without starting a run", async () => {
    try {
      await makeRun()({ trigger: "WHENEVER", actorName: "" });
      expect.fail("should have thrown");
    } catch (error) {
      expect((error as Error).name).to.equal("ValidationError");
    }
    expect(await db.conversationAuditRun.count()).to.equal(0);
  });

  describe("listConversationAuditFindings", () => {
    it("returns the run with findings, critical first, for an admin", async () => {
      await turn({ role: "AGENT", content: "Listo", failed: true });
      await turn({ role: "AGENT", content: "Tu puntaje es 74" });
      const { runId } = await makeRun()({ trigger: "SCHEDULED", actorName: "Sistema" });

      const detail = await callerAs(["ADMIN"]).listConversationAuditFindings({ runId });
      expect(detail!.run).to.include({ id: runId, criticalCount: 1, warningCount: 1 });
      expect(detail!.findings.map((f) => f.severity)).to.deep.equal(["CRITICAL", "WARNING"]);
      expect(detail!.findings[0]!.turn).to.include({ role: "AGENT", agentName: "sofia" });
      expect(detail!.findings[0]!.personLabel).to.equal(PHONE);
    });

    it("returns null for an unknown run", async () => {
      expect(await callerAs(["ADMIN"]).listConversationAuditFindings({ runId: "nope" })).to.equal(
        null
      );
    });

    it("is admin-only", async () => {
      try {
        await callerAs(["REVIEWER"]).listConversationAuditFindings({ runId: "x" });
        expect.fail("should have thrown");
      } catch (error) {
        expect((error as { code?: string }).code).to.equal("FORBIDDEN");
      }
    });
  });
});
