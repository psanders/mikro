/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Integration tests for the founder copilot (tasks 5.1). The LLM is always
 * stubbed — a fake model factory drives the tool loop deterministically, so no
 * live model is ever called. Covers: tool-policy binding, the write-tool →
 * pending-action short-circuit (no mutation), confirm (executes + records
 * copilot.action), reject and expiry (execute nothing), foreign-user refusal,
 * channel-filtered history, clear-history (soft delete, blocked by a pending
 * action), and admin-only authorization on all seven procedures.
 */
import { expect } from "chai";
import sinon from "sinon";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  createTestDb,
  createAuthenticatedCaller,
  applySchema,
  type TestDb,
  type AuthenticatedCaller
} from "./setup.js";
import { appRouter } from "../../src/trpc/index.js";
import {
  setCopilotDeps,
  clearCopilotDeps,
  getBoundToolNames
} from "../../src/api/copilot/index.js";
import { isWriteTool } from "../../src/api/copilot/toolPolicy.js";
import { summarizeAction } from "../../src/api/copilot/summarizeAction.js";
import {
  createRejectApplication,
  createApproveApplication
} from "../../src/api/applications/index.js";
import { COPILOT_ACTION_EXPIRY_MINUTES } from "@mikro/common";
import { createToolExecutor, type ToolResult, type ToolExecutor } from "@mikro/agents";

/** A fake AI turn: text plus optional tool calls. */
interface FakeTurn {
  content: string;
  tool_calls?: Array<{ id: string; name: string; args: Record<string, unknown> }>;
}

/**
 * Build a fake model factory that replays `turns` one per invoke, and records
 * the tools bound to it. Casts through unknown — createCopilotChat only uses
 * bindTools + invoke.
 */
function makeFakeModel(turns: FakeTurn[]) {
  const record: { boundTools: string[] } = { boundTools: [] };
  let i = 0;
  const factory = (): BaseChatModel =>
    ({
      bindTools(tools: Array<{ function: { name: string } }>) {
        record.boundTools = tools.map((t) => t.function.name);
        return {
          invoke: async () => turns[Math.min(i++, turns.length - 1)]
        };
      }
    }) as unknown as BaseChatModel;
  return { factory, record };
}

/** A tool executor that records calls and returns a canned result. */
function makeRecordingExecutor(result: ToolResult = { success: true, message: "OK" }) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const executor: ToolExecutor = async (name, args) => {
    calls.push({ name, args });
    return result;
  };
  return { executor, calls };
}

describe("Founder Copilot Integration", () => {
  let db: TestDb;
  let caller: AuthenticatedCaller;
  let phoneSeq = 0;
  const uniquePhone = () => {
    phoneSeq += 1;
    return `+1809${String(10_000_000 + phoneSeq).slice(1)}`;
  };

  const nonAdminCaller = () =>
    appRouter.createCaller({
      db: db as any,
      isAuthenticated: true,
      userId: "11111111-1111-4111-8111-111111111111",
      roles: ["COLLECTOR"]
    });

  /** Create an ADMIN user and a caller acting as that user (real FK for messages). */
  async function makeAdmin() {
    const admin = await caller.createUser({
      name: "Founder",
      phone: uniquePhone(),
      role: "ADMIN"
    });
    const adminCaller = appRouter.createCaller({
      db: db as any,
      isAuthenticated: true,
      userId: admin.id,
      roles: ["ADMIN"]
    });
    return { admin, adminCaller };
  }

  before(async () => {
    db = createTestDb();
    await applySchema(db);
  });

  beforeEach(async () => {
    await db.copilotPendingAction.deleteMany();
    await db.watchRule.deleteMany();
    await db.businessEvent.deleteMany();
    await db.loanApplication.deleteMany();
    await db.message.deleteMany();
    await db.userRole.deleteMany();
    await db.user.deleteMany();
    caller = createAuthenticatedCaller(db);
  });

  afterEach(() => {
    clearCopilotDeps();
  });

  after(async () => {
    await db.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // Tool policy
  // ---------------------------------------------------------------------------

  describe("tool policy", () => {
    it("binds only read/write/direct tools and nothing else", () => {
      const bound = getBoundToolNames();
      // A representative bound tool from each list.
      expect(bound).to.include("queryFeedEvents"); // read
      expect(bound).to.include("getApplicationById"); // read
      expect(bound).to.include("createPayment"); // write
      expect(bound).to.include("createWatchRule"); // direct
      expect(bound).to.include("githubFeedback"); // direct
      // Tools that exist in the agents registry but are NOT in any list.
      expect(bound).to.not.include("sendReceiptViaWhatsApp");
      expect(bound).to.not.include("saveAnswer");
      expect(bound).to.not.include("finalizeApplication");
      expect(bound).to.not.include("getApplicationState");
    });

    it("binds to the model exactly the policy tool set", async () => {
      const { adminCaller } = await makeAdmin();
      const fake = makeFakeModel([{ content: "Hola, ¿en qué puedo ayudarte?" }]);
      const { executor } = makeRecordingExecutor();
      setCopilotDeps({ toolExecutor: executor, createModel: fake.factory });

      await adminCaller.copilotChat({ message: "hola" });

      expect(fake.record.boundTools.sort()).to.deep.equal(getBoundToolNames().sort());
    });
  });

  // ---------------------------------------------------------------------------
  // Read answers
  // ---------------------------------------------------------------------------

  describe("read answers", () => {
    it("executes a read tool inline and returns provenance", async () => {
      const { adminCaller } = await makeAdmin();
      const fake = makeFakeModel([
        { content: "", tool_calls: [{ id: "c1", name: "queryFeedEvents", args: {} }] },
        { content: "No hubo eventos recientes." }
      ]);
      const { executor, calls } = makeRecordingExecutor();
      setCopilotDeps({ toolExecutor: executor, createModel: fake.factory });

      const reply = await adminCaller.copilotChat({ message: "¿qué pasó hoy?" });

      // queryFeedEvents is copilot-local — the shared executor is NOT used for it.
      expect(calls).to.have.lengthOf(0);
      expect(reply.reply).to.equal("No hubo eventos recientes.");
      expect(reply.provenance?.tools).to.include("queryFeedEvents");
      expect(reply.pendingAction).to.equal(undefined);
    });

    it("resolves a solicitud by UUID via getApplicationById, not a customer lookup", async () => {
      const { adminCaller } = await makeAdmin();
      const applicationId = "0a1dad76-f0ec-44cc-bc74-ddf4286a95f6";
      const fake = makeFakeModel([
        {
          content: "",
          tool_calls: [{ id: "c1", name: "getApplicationById", args: { id: applicationId } }]
        },
        { content: "La solicitud está en revisión con un ISC de 62." }
      ]);
      const { executor, calls } = makeRecordingExecutor({
        success: true,
        message: "Información de la solicitud obtenida.",
        data: { application: { id: applicationId, status: "IN_REVIEW", score: 62 } }
      });
      setCopilotDeps({ toolExecutor: executor, createModel: fake.factory });

      const reply = await adminCaller.copilotChat({
        message: `Muéstrame los detalles de la solicitud ${applicationId}`
      });

      expect(calls).to.have.lengthOf(1);
      expect(calls[0].name).to.equal("getApplicationById");
      expect(calls[0].args).to.deep.equal({ id: applicationId });
      expect(reply.reply).to.equal("La solicitud está en revisión con un ISC de 62.");
      expect(reply.reply).to.not.match(/cliente no encontrado/i);
    });
  });

  // ---------------------------------------------------------------------------
  // githubFeedback tool (issue #111)
  // ---------------------------------------------------------------------------

  describe("githubFeedback tool", () => {
    it("files an issue and discloses it in the reply", async () => {
      const { adminCaller } = await makeAdmin();
      const fake = makeFakeModel([
        {
          content: "",
          tool_calls: [
            {
              id: "c1",
              name: "githubFeedback",
              args: {
                category: "missing_capability",
                title: "No hay forma de buscar por ID de solicitud",
                summary: "El fundador pidió una solicitud por UUID y no había herramienta.",
                reasoning:
                  "Sin esto, el fundador no puede seguir el enlace 'Ver solicitud' del feed."
              }
            }
          ]
        },
        { content: "Ya reporté esta situación al equipo." }
      ]);
      const { executor } = makeRecordingExecutor();
      const fileFeedback = sinon.stub().resolves({ issueUrl: "https://github.com/o/r/issues/42" });
      setCopilotDeps({ toolExecutor: executor, createModel: fake.factory, fileFeedback });

      const reply = await adminCaller.copilotChat({ message: "no encontré la solicitud" });

      expect(fileFeedback.calledOnce).to.be.true;
      const filedInput = fileFeedback.firstCall.args[0];
      expect(filedInput.title).to.equal("No hay forma de buscar por ID de solicitud");
      expect(filedInput.body).to.contain("missing_capability");
      expect(reply.reply).to.contain("Registré esto como una mejora pendiente.");
    });

    it("attaches the prior failed tool call as context automatically", async () => {
      const { adminCaller } = await makeAdmin();
      const fake = makeFakeModel([
        {
          content: "",
          tool_calls: [{ id: "c1", name: "getApplicationById", args: { id: "missing-id" } }]
        },
        {
          content: "",
          tool_calls: [
            {
              id: "c2",
              name: "githubFeedback",
              args: {
                category: "bug",
                title: "Solicitud no encontrada",
                summary: "getApplicationById no encontró nada.",
                reasoning: "Puede ser un ID inválido, vale la pena revisar."
              }
            }
          ]
        },
        { content: "Reporté el problema." }
      ]);
      const { executor } = makeRecordingExecutor({
        success: false,
        message: "Solicitud no encontrada con el ID: missing-id",
        reason: "NOT_FOUND"
      });
      const fileFeedback = sinon.stub().resolves({ issueUrl: "https://github.com/o/r/issues/43" });
      setCopilotDeps({ toolExecutor: executor, createModel: fake.factory, fileFeedback });

      await adminCaller.copilotChat({ message: "muéstrame la solicitud missing-id" });

      const filedInput = fileFeedback.firstCall.args[0];
      expect(filedInput.body).to.contain("getApplicationById");
      expect(filedInput.body).to.contain("NOT_FOUND");
    });

    it("rejects a call missing reasoning, files nothing, discloses no success", async () => {
      const { adminCaller } = await makeAdmin();
      const fake = makeFakeModel([
        {
          content: "",
          tool_calls: [
            {
              id: "c1",
              name: "githubFeedback",
              args: { category: "other", title: "Algo", summary: "Algo pasó." }
            }
          ]
        },
        { content: "" }
      ]);
      const { executor } = makeRecordingExecutor();
      const fileFeedback = sinon.stub().resolves({ issueUrl: "https://github.com/o/r/issues/44" });
      setCopilotDeps({ toolExecutor: executor, createModel: fake.factory, fileFeedback });

      const reply = await adminCaller.copilotChat({ message: "algo" });

      expect(fileFeedback.called).to.be.false;
      expect(reply.reply).to.not.contain("Registré esto como una mejora pendiente.");
    });

    it("discloses failure without breaking the turn when filing fails", async () => {
      const { adminCaller } = await makeAdmin();
      const fake = makeFakeModel([
        {
          content: "",
          tool_calls: [
            {
              id: "c1",
              name: "githubFeedback",
              args: {
                category: "ui_suggestion",
                title: "Falta una tarjeta de X",
                summary: "Sería útil ver X en el dashboard.",
                reasoning: "El fundador lo pidió dos veces esta semana."
              }
            }
          ]
        },
        { content: "" }
      ]);
      const { executor } = makeRecordingExecutor();
      const fileFeedback = sinon.stub().rejects(new Error("token inválido"));
      setCopilotDeps({ toolExecutor: executor, createModel: fake.factory, fileFeedback });

      const reply = await adminCaller.copilotChat({ message: "sería bueno ver X" });

      expect(reply.reply).to.contain("no se pudo completar");
    });

    it("reports not configured when fileFeedback is absent, breaks nothing", async () => {
      const { adminCaller } = await makeAdmin();
      const fake = makeFakeModel([
        {
          content: "",
          tool_calls: [
            {
              id: "c1",
              name: "githubFeedback",
              args: {
                category: "bug",
                title: "Algo",
                summary: "Algo pasó.",
                reasoning: "Porque sí."
              }
            }
          ]
        },
        { content: "" }
      ]);
      const { executor } = makeRecordingExecutor();
      setCopilotDeps({ toolExecutor: executor, createModel: fake.factory }); // no fileFeedback

      const reply = await adminCaller.copilotChat({ message: "algo" });

      expect(reply.reply).to.contain("no se pudo completar");
    });
  });

  // ---------------------------------------------------------------------------
  // Write short-circuit + confirm/reject lifecycle
  // ---------------------------------------------------------------------------

  describe("write short-circuit", () => {
    it("persists a PENDING action and executes nothing", async () => {
      const { admin, adminCaller } = await makeAdmin();
      const fake = makeFakeModel([
        {
          content: "Voy a registrar el pago.",
          tool_calls: [
            { id: "c1", name: "createPayment", args: { loanId: "10000", amount: "650" } }
          ]
        }
      ]);
      const { executor, calls } = makeRecordingExecutor();
      setCopilotDeps({ toolExecutor: executor, createModel: fake.factory });

      const reply = await adminCaller.copilotChat({ message: "registra 650 en el 10000" });

      expect(calls, "no tool executed inline").to.have.lengthOf(0);
      expect(reply.pendingAction).to.not.equal(undefined);
      expect(reply.pendingAction?.toolName).to.equal("createPayment");
      expect(reply.pendingAction?.status).to.equal("PENDING");

      const rows = await db.copilotPendingAction.findMany({ where: { userId: admin.id } });
      expect(rows).to.have.lengthOf(1);
      expect(rows[0].status).to.equal("PENDING");
      // No business event yet.
      expect(await db.businessEvent.count()).to.equal(0);
    });
  });

  describe("confirm / reject lifecycle", () => {
    it("confirm executes the tool and records copilot.action", async () => {
      const { admin, adminCaller } = await makeAdmin();
      const { executor, calls } = makeRecordingExecutor({
        success: true,
        message: "Pago registrado."
      });
      setCopilotDeps({
        toolExecutor: executor,
        createModel: makeFakeModel([{ content: "" }]).factory
      });

      const action = await db.copilotPendingAction.create({
        data: {
          userId: admin.id,
          toolName: "createPayment",
          argsJson: JSON.stringify({ loanId: "10000", amount: "650" }),
          summary: "Registrar un pago de RD$650 en el préstamo #10000.",
          status: "PENDING"
        }
      });

      const res = await adminCaller.copilotConfirmAction({ actionId: action.id });
      expect(res.status).to.equal("CONFIRMED");

      expect(calls).to.have.lengthOf(1);
      expect(calls[0].name).to.equal("createPayment");

      const events = await db.businessEvent.findMany({ where: { type: "copilot.action" } });
      expect(events).to.have.lengthOf(1);
      expect(events[0].actorId).to.equal(admin.id);
      const payload = JSON.parse(events[0].payload);
      expect(payload.toolName).to.equal("createPayment");
      expect(payload.resultSummary).to.equal("Pago registrado.");

      const refreshed = await db.copilotPendingAction.findUnique({ where: { id: action.id } });
      expect(refreshed?.status).to.equal("CONFIRMED");
    });

    it("reject executes nothing and records no event", async () => {
      const { admin, adminCaller } = await makeAdmin();
      const { executor, calls } = makeRecordingExecutor();
      setCopilotDeps({
        toolExecutor: executor,
        createModel: makeFakeModel([{ content: "" }]).factory
      });

      const action = await db.copilotPendingAction.create({
        data: {
          userId: admin.id,
          toolName: "createPayment",
          argsJson: JSON.stringify({ loanId: "10000", amount: "650" }),
          summary: "Registrar un pago.",
          status: "PENDING"
        }
      });

      const res = await adminCaller.copilotRejectAction({ actionId: action.id });
      expect(res.status).to.equal("REJECTED");
      expect(calls).to.have.lengthOf(0);
      expect(await db.businessEvent.count()).to.equal(0);

      const refreshed = await db.copilotPendingAction.findUnique({ where: { id: action.id } });
      expect(refreshed?.status).to.equal("REJECTED");
    });

    it("refuses an expired action, marks it EXPIRED, executes nothing", async () => {
      const { admin, adminCaller } = await makeAdmin();
      const { executor, calls } = makeRecordingExecutor();
      setCopilotDeps({
        toolExecutor: executor,
        createModel: makeFakeModel([{ content: "" }]).factory
      });

      const stale = new Date(Date.now() - 20 * 60 * 1000); // 20 min ago (> 15)
      const action = await db.copilotPendingAction.create({
        data: {
          userId: admin.id,
          toolName: "createPayment",
          argsJson: JSON.stringify({ loanId: "10000", amount: "650" }),
          summary: "Registrar un pago.",
          status: "PENDING",
          createdAt: stale
        }
      });

      let threw = false;
      try {
        await adminCaller.copilotConfirmAction({ actionId: action.id });
      } catch (err) {
        threw = true;
        expect((err as Error).message).to.match(/expir/i);
      }
      expect(threw, "confirm should throw").to.equal(true);
      expect(calls).to.have.lengthOf(0);

      const refreshed = await db.copilotPendingAction.findUnique({ where: { id: action.id } });
      expect(refreshed?.status).to.equal("EXPIRED");
    });

    it("refuses to confirm another user's action", async () => {
      const { adminCaller } = await makeAdmin();
      const { executor, calls } = makeRecordingExecutor();
      setCopilotDeps({
        toolExecutor: executor,
        createModel: makeFakeModel([{ content: "" }]).factory
      });

      // Action owned by a different user id.
      const action = await db.copilotPendingAction.create({
        data: {
          userId: "22222222-2222-4222-8222-222222222222",
          toolName: "createPayment",
          argsJson: JSON.stringify({ loanId: "10000", amount: "650" }),
          summary: "Registrar un pago.",
          status: "PENDING"
        }
      });

      let threw = false;
      try {
        await adminCaller.copilotConfirmAction({ actionId: action.id });
      } catch (err) {
        threw = true;
        expect((err as any).code === "FORBIDDEN" || /otro usuario/i.test((err as Error).message)).to
          .be.true;
      }
      expect(threw).to.equal(true);
      expect(calls).to.have.lengthOf(0);

      const refreshed = await db.copilotPendingAction.findUnique({ where: { id: action.id } });
      expect(refreshed?.status).to.equal("PENDING");
    });
  });

  // ---------------------------------------------------------------------------
  // Application review write tools (issue #114)
  // ---------------------------------------------------------------------------

  describe("application review write tools", () => {
    /** Seed a solicitud in a given status; returns its id. */
    async function seedApplication(status: string): Promise<string> {
      phoneSeq += 1;
      const app = await db.loanApplication.create({
        data: {
          sessionId: `sess-${phoneSeq}-${Date.now()}`,
          status,
          firstName: "Elena",
          lastName: "Ramírez",
          rawData: {}
        }
      });
      return app.id;
    }

    it("classifies approve/reject/delete as write tools and binds them", () => {
      for (const name of ["approveApplication", "rejectApplication", "deleteApplication"]) {
        expect(isWriteTool(name), `${name} isWriteTool`).to.be.true;
        expect(getBoundToolNames(), `${name} bound`).to.include(name);
      }
    });

    it("summarizes a rejection with its reason (not the generic fallback)", () => {
      const summary = summarizeAction("rejectApplication", {
        id: "app-x",
        reason: "Capacidad de pago insuficiente"
      });
      expect(summary).to.match(/Rechazar la solicitud app-x/);
      expect(summary).to.contain("Capacidad de pago insuficiente");
      expect(summary).to.not.contain("Ejecutar rejectApplication");
    });

    it("a reject tool call is short-circuited into a PENDING action, nothing executes", async () => {
      const { admin, adminCaller } = await makeAdmin();
      const appId = await seedApplication("RECEIVED");
      const fake = makeFakeModel([
        {
          content: "Voy a rechazar la solicitud.",
          tool_calls: [
            {
              id: "c1",
              name: "rejectApplication",
              args: { id: appId, reason: "Documentación incompleta" }
            }
          ]
        }
      ]);
      const { executor, calls } = makeRecordingExecutor();
      setCopilotDeps({ toolExecutor: executor, createModel: fake.factory });

      const reply = await adminCaller.copilotChat({ message: `rechaza la solicitud ${appId}` });

      expect(calls, "no tool executed inline").to.have.lengthOf(0);
      expect(reply.pendingAction?.toolName).to.equal("rejectApplication");
      expect(reply.pendingAction?.summary).to.contain("Documentación incompleta");

      // Application untouched, no event.
      const row = await db.loanApplication.findUnique({ where: { id: appId } });
      expect(row?.status).to.equal("RECEIVED");
      expect(await db.businessEvent.count()).to.equal(0);

      const pending = await db.copilotPendingAction.findMany({ where: { userId: admin.id } });
      expect(pending).to.have.lengthOf(1);
      expect(pending[0].status).to.equal("PENDING");
    });

    it("confirming a rejection transitions to REJECTED, stores the reason, records copilot.action", async () => {
      const { admin, adminCaller } = await makeAdmin();
      const appId = await seedApplication("RECEIVED");

      // A REAL executor wired to the review procedure, so the confirm actually mutates.
      const realExecutor = createToolExecutor({
        rejectApplication: createRejectApplication(db as any)
      } as any);
      setCopilotDeps({
        toolExecutor: realExecutor,
        createModel: makeFakeModel([{ content: "" }]).factory
      });

      const reason = "Capacidad de pago insuficiente";
      const action = await db.copilotPendingAction.create({
        data: {
          userId: admin.id,
          toolName: "rejectApplication",
          argsJson: JSON.stringify({ id: appId, reason }),
          summary: `Rechazar la solicitud ${appId} por el motivo: ${reason}.`,
          status: "PENDING"
        }
      });

      const res = await adminCaller.copilotConfirmAction({ actionId: action.id });
      expect(res.status).to.equal("CONFIRMED");

      // Row moved to REJECTED with the reason preserved as the review note (audit).
      const row = await db.loanApplication.findUnique({ where: { id: appId } });
      expect(row?.status).to.equal("REJECTED");
      expect(row?.reviewNote).to.equal(reason);
      expect(row?.reviewedById).to.equal(admin.id);

      // Exactly one copilot.action event carrying the tool + args.
      const events = await db.businessEvent.findMany({ where: { type: "copilot.action" } });
      expect(events).to.have.lengthOf(1);
      const payload = JSON.parse(events[0].payload);
      expect(payload.toolName).to.equal("rejectApplication");
      expect(payload.args.reason).to.equal(reason);
    });

    it("confirming an approve on a wrong-status solicitud is refused, nothing changes", async () => {
      const { admin, adminCaller } = await makeAdmin();
      const appId = await seedApplication("CONVERTED"); // not a valid source for approve

      const realExecutor = createToolExecutor({
        approveApplication: createApproveApplication(db as any)
      } as any);
      setCopilotDeps({
        toolExecutor: realExecutor,
        createModel: makeFakeModel([{ content: "" }]).factory
      });

      const action = await db.copilotPendingAction.create({
        data: {
          userId: admin.id,
          toolName: "approveApplication",
          argsJson: JSON.stringify({ id: appId }),
          summary: `Aprobar la solicitud ${appId}.`,
          status: "PENDING"
        }
      });

      let threw = false;
      try {
        await adminCaller.copilotConfirmAction({ actionId: action.id });
      } catch {
        threw = true;
      }
      expect(threw, "confirm should throw on an invalid transition").to.equal(true);

      const row = await db.loanApplication.findUnique({ where: { id: appId } });
      expect(row?.status).to.equal("CONVERTED");
      expect(await db.businessEvent.count()).to.equal(0);
    });
  });

  // ---------------------------------------------------------------------------
  // History
  // ---------------------------------------------------------------------------

  describe("getCopilotHistory", () => {
    it("returns only copilot-channel messages for the caller", async () => {
      const { admin, adminCaller } = await makeAdmin();
      await db.message.create({
        data: { role: "HUMAN", content: "copiloto hola", userId: admin.id, channel: "copilot" }
      });
      await db.message.create({
        data: { role: "AI", content: "hola founder", userId: admin.id, channel: "copilot" }
      });
      // A WhatsApp-channel message for the same user must be excluded.
      await db.message.create({
        data: { role: "HUMAN", content: "whatsapp msg", userId: admin.id, channel: "whatsapp" }
      });

      const history = await adminCaller.getCopilotHistory({});
      expect(history.messages).to.have.lengthOf(2);
      expect(history.messages.map((m) => m.content)).to.not.include("whatsapp msg");
    });
  });

  // ---------------------------------------------------------------------------
  // Clear history (soft delete)
  // ---------------------------------------------------------------------------

  describe("clearCopilotHistory", () => {
    it("soft-deletes the caller's copilot messages only", async () => {
      const { admin, adminCaller } = await makeAdmin();
      const { admin: otherAdmin } = await makeAdmin();

      await db.message.create({
        data: { role: "HUMAN", content: "mío copilot", userId: admin.id, channel: "copilot" }
      });
      await db.message.create({
        data: { role: "AI", content: "respuesta", userId: admin.id, channel: "copilot" }
      });
      await db.message.create({
        data: { role: "HUMAN", content: "mío whatsapp", userId: admin.id, channel: "whatsapp" }
      });
      await db.message.create({
        data: {
          role: "HUMAN",
          content: "de otro founder",
          userId: otherAdmin.id,
          channel: "copilot"
        }
      });

      const res = await adminCaller.clearCopilotHistory({});
      expect(res.cleared).to.equal(2);

      const mine = await db.message.findMany({ where: { userId: admin.id } });
      const mineCopilot = mine.filter((m) => m.channel === "copilot");
      const mineWhatsapp = mine.filter((m) => m.channel === "whatsapp");
      expect(mineCopilot.every((m) => m.deletedAt !== null)).to.equal(true);
      expect(mineWhatsapp.every((m) => m.deletedAt === null)).to.equal(true);

      const others = await db.message.findMany({ where: { userId: otherAdmin.id } });
      expect(others.every((m) => m.deletedAt === null)).to.equal(true);
    });

    it("refuses to clear while a pending unexpired action exists, clears nothing", async () => {
      const { admin, adminCaller } = await makeAdmin();
      await db.message.create({
        data: { role: "HUMAN", content: "hola", userId: admin.id, channel: "copilot" }
      });
      await db.copilotPendingAction.create({
        data: {
          userId: admin.id,
          toolName: "createPayment",
          argsJson: JSON.stringify({ loanId: "10000", amount: "650" }),
          summary: "Registrar un pago.",
          status: "PENDING"
        }
      });

      let threw = false;
      try {
        await adminCaller.clearCopilotHistory({});
      } catch (err) {
        threw = true;
        expect((err as any).code).to.equal("PRECONDITION_FAILED");
      }
      expect(threw, "clear should throw while pending").to.equal(true);

      const rows = await db.message.findMany({ where: { userId: admin.id, channel: "copilot" } });
      expect(rows.every((m) => m.deletedAt === null)).to.equal(true);
    });

    it("allows clearing when the only pending action is expired", async () => {
      const { admin, adminCaller } = await makeAdmin();
      await db.message.create({
        data: { role: "HUMAN", content: "hola", userId: admin.id, channel: "copilot" }
      });
      const stale = new Date(Date.now() - (COPILOT_ACTION_EXPIRY_MINUTES + 5) * 60 * 1000);
      await db.copilotPendingAction.create({
        data: {
          userId: admin.id,
          toolName: "createPayment",
          argsJson: JSON.stringify({ loanId: "10000", amount: "650" }),
          summary: "Registrar un pago.",
          status: "PENDING",
          createdAt: stale
        }
      });

      const res = await adminCaller.clearCopilotHistory({});
      expect(res.cleared).to.equal(1);
    });

    it("excludes soft-deleted rows from getCopilotHistory", async () => {
      const { admin, adminCaller } = await makeAdmin();
      await db.message.create({
        data: { role: "HUMAN", content: "antes de borrar", userId: admin.id, channel: "copilot" }
      });

      await adminCaller.clearCopilotHistory({});
      await db.message.create({
        data: { role: "HUMAN", content: "después de borrar", userId: admin.id, channel: "copilot" }
      });

      const history = await adminCaller.getCopilotHistory({});
      expect(history.messages).to.have.lengthOf(1);
      expect(history.messages[0].content).to.equal("después de borrar");
    });
  });

  // ---------------------------------------------------------------------------
  // Authorization
  // ---------------------------------------------------------------------------

  describe("authorization", () => {
    beforeEach(() => {
      setCopilotDeps({
        toolExecutor: makeRecordingExecutor().executor,
        createModel: makeFakeModel([{ content: "" }]).factory
      });
    });

    it("rejects non-admins on all seven procedures", async () => {
      const c = nonAdminCaller();
      const id = "33333333-3333-4333-8333-333333333333";
      const attempts: Array<Promise<unknown>> = [
        c.copilotChat({ message: "hi" }),
        c.copilotConfirmAction({ actionId: id }),
        c.copilotRejectAction({ actionId: id }),
        c.getCopilotHistory({}),
        c.clearCopilotHistory({}),
        c.listWatchRules({}),
        c.setWatchRuleEnabled({ id, enabled: false })
      ];

      const results = await Promise.allSettled(attempts);
      for (const r of results) {
        expect(r.status).to.equal("rejected");
        if (r.status === "rejected") {
          expect(r.reason.code).to.equal("FORBIDDEN");
        }
      }
    });
  });
});
