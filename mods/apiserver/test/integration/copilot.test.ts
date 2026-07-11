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
import { recordQCobroSyncedEvent } from "../../src/qcobro/index.js";
import { createCreateTransaction } from "../../src/api/accounting/index.js";

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
  const record: { boundTools: string[]; invokedMessages: unknown[][] } = {
    boundTools: [],
    invokedMessages: []
  };
  let i = 0;
  const factory = (): BaseChatModel =>
    ({
      bindTools(tools: Array<{ function: { name: string } }>) {
        record.boundTools = tools.map((t) => t.function.name);
        return {
          invoke: async (messages: unknown[]) => {
            record.invokedMessages.push(messages);
            return turns[Math.min(i++, turns.length - 1)];
          }
        };
      }
    }) as unknown as BaseChatModel;
  return { factory, record };
}

/** Find the ToolMessage content (parsed JSON) for a given tool name across all invoke calls. */
function findToolResult(invokedMessages: unknown[][], toolName: string): Record<string, unknown> {
  for (const messages of invokedMessages) {
    for (const m of messages as Array<{ name?: string; content?: unknown }>) {
      if (m?.name === toolName) {
        return JSON.parse(m.content as string);
      }
    }
  }
  throw new Error(`No tool message found for ${toolName}`);
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
    await db.accountingTransaction.deleteMany();
    await db.accountingAccount.deleteMany();
    await db.payment.deleteMany();
    await db.loan.deleteMany();
    await db.customer.deleteMany();
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
      expect(bound).to.include("listCustomerLoansByPhone"); // read (#119)
      expect(bound).to.include("createPayment"); // write
      expect(bound).to.include("sendReceiptViaWhatsApp"); // write (#118)
      expect(bound).to.include("createWatchRule"); // direct
      expect(bound).to.include("githubFeedback"); // direct
      // Tools that exist in the agents registry but are NOT in any list.
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

    it("getDailyCashCollected sums today's non-reversed payments (mikro/#115)", async () => {
      const { adminCaller } = await makeAdmin();
      const collector = await caller.createUser({
        name: "Cobrador",
        phone: uniquePhone(),
        role: "COLLECTOR"
      });
      const customer = await caller.createCustomer({
        name: "Cliente",
        phone: uniquePhone(),
        idNumber: `001-${String(Date.now()).slice(-7)}-9`,
        collectionPoint: "https://example.com/p",
        homeAddress: "Calle 1",
        assignedCollectorId: collector.id
      });
      const loan = await db.loan.create({
        data: {
          loanId: 90001,
          principal: 5000,
          termLength: 10,
          paymentAmount: 650,
          paymentFrequency: "WEEKLY",
          status: "ACTIVE",
          startingDate: new Date(),
          customerId: customer.id
        }
      });
      await db.payment.create({
        data: { amount: 650, paidAt: new Date(), loanId: loan.id, collectedById: collector.id }
      });
      await db.payment.create({
        data: { amount: 350, paidAt: new Date(), loanId: loan.id, collectedById: collector.id }
      });

      const fake = makeFakeModel([
        { content: "", tool_calls: [{ id: "c1", name: "getDailyCashCollected", args: {} }] },
        { content: "Se ha cobrado RD$1,000 hoy." }
      ]);
      const { executor, calls } = makeRecordingExecutor();
      setCopilotDeps({ toolExecutor: executor, createModel: fake.factory });

      const reply = await adminCaller.copilotChat({ message: "¿cuánto se ha cobrado hoy?" });

      // getDailyCashCollected is copilot-local — the shared executor is NOT used.
      expect(calls).to.have.lengthOf(0);
      expect(reply.reply).to.equal("Se ha cobrado RD$1,000 hoy.");
      const toolResult = findToolResult(fake.record.invokedMessages, "getDailyCashCollected");
      expect(toolResult.success).to.equal(true);
      const data = toolResult.data as { totalCollected: number };
      expect(data.totalCollected).to.equal(1000);
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

    it("resolves a customer's loans by phone in one call (issue #119)", async () => {
      const { adminCaller } = await makeAdmin();
      const phone = "+18095551234";
      const fake = makeFakeModel([
        {
          content: "",
          tool_calls: [{ id: "c1", name: "listCustomerLoansByPhone", args: { phone } }]
        },
        { content: "Elena Ramírez tiene 1 préstamo activo, el #218." }
      ]);
      const { executor, calls } = makeRecordingExecutor({
        success: true,
        message: "Se encontraron 1 préstamos para Elena Ramírez.",
        data: {
          customer: { id: "cust-1", name: "Elena Ramírez", phone },
          loans: [{ id: "218" }]
        }
      });
      setCopilotDeps({ toolExecutor: executor, createModel: fake.factory });

      const reply = await adminCaller.copilotChat({
        message: `Registra un pago al ${phone}`
      });

      expect(calls).to.have.lengthOf(1);
      expect(calls[0].name).to.equal("listCustomerLoansByPhone");
      expect(calls[0].args).to.deep.equal({ phone });
      expect(reply.reply).to.equal("Elena Ramírez tiene 1 préstamo activo, el #218.");
      expect(reply.pendingAction).to.equal(undefined);
    });
  });

  // ---------------------------------------------------------------------------
  // queryFeedEvents amount field (mikro/#115)
  // ---------------------------------------------------------------------------

  describe("queryFeedEvents amount field (mikro/#115)", () => {
    it("includes the event amount so the model can sum payment events", async () => {
      const { adminCaller } = await makeAdmin();
      await db.businessEvent.create({
        data: {
          type: "payment.collected",
          actorName: "Cobrador",
          amount: 650,
          summary: "Cobrador cobró RD$650",
          payload: "{}"
        }
      });
      await db.businessEvent.create({
        data: {
          type: "application.deleted",
          actorName: "Fundador",
          summary: "Se eliminó una solicitud",
          payload: "{}"
        }
      });

      const fake = makeFakeModel([
        { content: "", tool_calls: [{ id: "c1", name: "queryFeedEvents", args: {} }] },
        { content: "Se cobraron RD$650 hoy." }
      ]);
      const { executor } = makeRecordingExecutor();
      setCopilotDeps({ toolExecutor: executor, createModel: fake.factory });

      await adminCaller.copilotChat({ message: "¿qué pasó hoy?" });

      const toolResult = findToolResult(fake.record.invokedMessages, "queryFeedEvents");
      const events = toolResult.data as { events: Array<{ type: string; amount: number | null }> };
      const payment = events.events.find((e) => e.type === "payment.collected");
      const deletion = events.events.find((e) => e.type === "application.deleted");
      expect(payment?.amount).to.equal(650);
      expect(deletion?.amount).to.equal(null);
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

  describe("customer/loan form cards", () => {
    // Two turns: the first proposes the DIRECT tool call, the second (no
    // tool_calls) ends the loop — DIRECT tools don't short-circuit like
    // WRITE tools do, so the model is re-invoked once with the tool result.
    it("openCustomerForm opens the card and creates nothing", async () => {
      const { adminCaller } = await makeAdmin();
      const fake = makeFakeModel([
        { content: "", tool_calls: [{ id: "c1", name: "openCustomerForm", args: {} }] },
        { content: "Listo, aquí tienes el formulario." }
      ]);
      const { executor, calls } = makeRecordingExecutor();
      setCopilotDeps({ toolExecutor: executor, createModel: fake.factory });

      const reply = await adminCaller.copilotChat({ message: "creá un cliente nuevo" });

      expect(calls, "no read/write tool executed").to.have.lengthOf(0);
      expect(reply.customerForm).to.deep.equal({});
      expect(reply.pendingAction).to.equal(undefined);
      expect(await db.customer.count()).to.equal(0);
    });

    it("openLoanForm opens the card with a customer hint and creates nothing", async () => {
      const { adminCaller } = await makeAdmin();
      const fake = makeFakeModel([
        {
          content: "",
          tool_calls: [{ id: "c1", name: "openLoanForm", args: { customerHint: " Enersida " } }]
        },
        { content: "Listo, aquí tienes el formulario." }
      ]);
      const { executor, calls } = makeRecordingExecutor();
      setCopilotDeps({ toolExecutor: executor, createModel: fake.factory });

      const reply = await adminCaller.copilotChat({ message: "creá un préstamo para Enersida" });

      expect(calls, "no read/write tool executed").to.have.lengthOf(0);
      expect(reply.loanForm).to.deep.equal({ customerHint: "Enersida" });
      expect(reply.pendingAction).to.equal(undefined);
      expect(await db.loan.count()).to.equal(0);
    });

    it("openLoanForm without a hint returns an empty loanForm", async () => {
      const { adminCaller } = await makeAdmin();
      const fake = makeFakeModel([
        { content: "", tool_calls: [{ id: "c1", name: "openLoanForm", args: {} }] },
        { content: "Listo, aquí tienes el formulario." }
      ]);
      const { executor, calls } = makeRecordingExecutor();
      setCopilotDeps({ toolExecutor: executor, createModel: fake.factory });

      const reply = await adminCaller.copilotChat({ message: "necesito abrir un préstamo" });

      expect(calls, "no read/write tool executed").to.have.lengthOf(0);
      expect(reply.loanForm).to.deep.equal({});
      expect(await db.loan.count()).to.equal(0);
    });

    it("falls back to a form-specific reply when the model's own text is empty", async () => {
      const { adminCaller } = await makeAdmin();
      const fake = makeFakeModel([
        { content: "", tool_calls: [{ id: "c1", name: "openCustomerForm", args: {} }] },
        { content: "" }
      ]);
      const { executor } = makeRecordingExecutor();
      setCopilotDeps({ toolExecutor: executor, createModel: fake.factory });

      const reply = await adminCaller.copilotChat({ message: "creá un cliente nuevo" });

      expect(reply.reply).to.equal("Listo. Completá los datos del cliente y lo creo.");
    });
  });

  describe("generateLoanStatement", () => {
    // DIRECT tool (read-only, no confirm gate) — moved off the retired
    // `loan-statement` task automation onto an on-demand copilot tool
    // (mikro/move-loan-statement-to-copilot). Calls the same
    // `createGenerateLoanStatement` builder the tRPC mutation and CLI use.
    async function seedLoan(loanId: number) {
      const collector = await caller.createUser({
        name: "Cobrador",
        phone: uniquePhone(),
        role: "COLLECTOR"
      });
      const customer = await caller.createCustomer({
        name: "Cliente Prueba",
        phone: uniquePhone(),
        idNumber: `001-${String(Date.now()).slice(-7)}-9`,
        collectionPoint: "https://example.com/p",
        homeAddress: "Calle 1",
        assignedCollectorId: collector.id
      });
      const loan = await db.loan.create({
        data: {
          loanId,
          principal: 4000,
          termLength: 4,
          paymentAmount: 1000,
          paymentFrequency: "WEEKLY",
          status: "ACTIVE",
          startingDate: new Date("2026-06-01T00:00:00.000Z"),
          customerId: customer.id
        }
      });
      await db.payment.create({
        data: {
          amount: 1000,
          paidAt: new Date("2026-06-02T10:00:00Z"),
          loanId: loan.id,
          collectedById: collector.id
        }
      });
      return loan;
    }

    it("generates the statement inline and delivers it as a document in the same turn", async () => {
      const { adminCaller } = await makeAdmin();
      await seedLoan(90010);
      const fake = makeFakeModel([
        {
          content: "",
          tool_calls: [{ id: "c1", name: "generateLoanStatement", args: { loanId: "90010" } }]
        },
        { content: "Aquí tienes el estado de cuenta." }
      ]);
      const { executor, calls } = makeRecordingExecutor();
      setCopilotDeps({ toolExecutor: executor, createModel: fake.factory });

      const reply = await adminCaller.copilotChat({
        message: "dame el estado de cuenta del préstamo 90010"
      });

      // generateLoanStatement is copilot-local — the shared executor is NOT used.
      expect(calls, "no shared read/write tool executed").to.have.lengthOf(0);
      expect(reply.pendingAction, "read-only: nothing to confirm").to.equal(undefined);
      expect(reply.document).to.not.equal(undefined);
      expect(reply.document!.filename).to.match(/^estado-cuenta-90010-.*\.pdf$/);
      expect(reply.document!.mimeType).to.equal("application/pdf");
      expect(reply.document!.base64.length).to.be.greaterThan(0);
      expect(reply.provenance?.tools).to.include("generateLoanStatement");
    });

    it("defaults to pdf but honors an explicit json format", async () => {
      const { adminCaller } = await makeAdmin();
      await seedLoan(90011);
      const fake = makeFakeModel([
        {
          content: "",
          tool_calls: [
            { id: "c1", name: "generateLoanStatement", args: { loanId: "90011", format: "json" } }
          ]
        },
        { content: "Aquí tienes el estado de cuenta en JSON." }
      ]);
      setCopilotDeps({
        toolExecutor: makeRecordingExecutor().executor,
        createModel: fake.factory
      });

      const reply = await adminCaller.copilotChat({
        message: "dame el estado de cuenta del préstamo 90011 en JSON"
      });

      expect(reply.document!.filename).to.match(/^estado-cuenta-90011-.*\.json$/);
      expect(reply.document!.mimeType).to.equal("application/json");
      const decoded = JSON.parse(Buffer.from(reply.document!.base64, "base64").toString("utf-8"));
      expect(decoded.loanId).to.equal(90011);
    });

    it("unknown loan id produces no document — validation-failure case", async () => {
      const { adminCaller } = await makeAdmin();
      const fake = makeFakeModel([
        {
          content: "",
          tool_calls: [{ id: "c1", name: "generateLoanStatement", args: { loanId: "99999" } }]
        },
        { content: "No se encontró el préstamo #99999." }
      ]);
      setCopilotDeps({
        toolExecutor: makeRecordingExecutor().executor,
        createModel: fake.factory
      });

      const reply = await adminCaller.copilotChat({
        message: "dame el estado de cuenta del préstamo 99999"
      });

      expect(reply.document).to.equal(undefined);
      const toolResult = findToolResult(fake.record.invokedMessages, "generateLoanStatement");
      expect(toolResult.success).to.equal(false);
    });

    it("is bound as a direct tool — read, not write", () => {
      expect(isWriteTool("generateLoanStatement")).to.equal(false);
      expect(getBoundToolNames()).to.include("generateLoanStatement");
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
  // sendReceiptViaWhatsApp (issue #118, Maria/Juan parity)
  // ---------------------------------------------------------------------------

  describe("sendReceiptViaWhatsApp", () => {
    it("classifies sendReceiptViaWhatsApp as a write tool and binds it", () => {
      expect(isWriteTool("sendReceiptViaWhatsApp")).to.be.true;
      expect(getBoundToolNames()).to.include("sendReceiptViaWhatsApp");
    });

    it("summarizes the action with the recipient phone", () => {
      expect(
        summarizeAction("sendReceiptViaWhatsApp", {
          paymentId: "11111111-1111-4111-8111-111111111111",
          phone: "+18095551234"
        })
      ).to.equal("Enviar el recibo del pago por WhatsApp al +18095551234.");
    });

    it("a tool call is short-circuited into a PENDING action, nothing executes", async () => {
      const { admin, adminCaller } = await makeAdmin();
      const fake = makeFakeModel([
        {
          content: "Voy a enviar el recibo.",
          tool_calls: [
            {
              id: "c1",
              name: "sendReceiptViaWhatsApp",
              args: { paymentId: "11111111-1111-4111-8111-111111111111", phone: "+18095551234" }
            }
          ]
        }
      ]);
      const { executor, calls } = makeRecordingExecutor();
      setCopilotDeps({ toolExecutor: executor, createModel: fake.factory });

      const reply = await adminCaller.copilotChat({ message: "envía el recibo del último pago" });

      expect(calls, "no tool executed inline").to.have.lengthOf(0);
      expect(reply.pendingAction?.toolName).to.equal("sendReceiptViaWhatsApp");
      expect(reply.pendingAction?.status).to.equal("PENDING");

      const pending = await db.copilotPendingAction.findMany({ where: { userId: admin.id } });
      expect(pending).to.have.lengthOf(1);
      expect(pending[0].status).to.equal("PENDING");
      expect(await db.businessEvent.count()).to.equal(0);
    });

    it("confirming executes the tool through the shared executor and records copilot.action", async () => {
      const { admin, adminCaller } = await makeAdmin();
      const { executor, calls } = makeRecordingExecutor({
        success: true,
        message: "Recibo enviado por WhatsApp."
      });
      setCopilotDeps({
        toolExecutor: executor,
        createModel: makeFakeModel([{ content: "" }]).factory
      });

      const action = await db.copilotPendingAction.create({
        data: {
          userId: admin.id,
          toolName: "sendReceiptViaWhatsApp",
          argsJson: JSON.stringify({
            paymentId: "11111111-1111-4111-8111-111111111111",
            phone: "+18095551234"
          }),
          summary: "Enviar el recibo del pago por WhatsApp al +18095551234.",
          status: "PENDING"
        }
      });

      const res = await adminCaller.copilotConfirmAction({ actionId: action.id });
      expect(res.status).to.equal("CONFIRMED");
      expect(calls).to.have.lengthOf(1);
      expect(calls[0].name).to.equal("sendReceiptViaWhatsApp");
      expect(calls[0].args).to.deep.equal({
        paymentId: "11111111-1111-4111-8111-111111111111",
        phone: "+18095551234"
      });

      const events = await db.businessEvent.findMany({ where: { type: "copilot.action" } });
      expect(events).to.have.lengthOf(1);
      expect(JSON.parse(events[0].payload).toolName).to.equal("sendReceiptViaWhatsApp");
    });

    it("rejecting sends nothing", async () => {
      const { admin, adminCaller } = await makeAdmin();
      const { executor, calls } = makeRecordingExecutor();
      setCopilotDeps({
        toolExecutor: executor,
        createModel: makeFakeModel([{ content: "" }]).factory
      });

      const action = await db.copilotPendingAction.create({
        data: {
          userId: admin.id,
          toolName: "sendReceiptViaWhatsApp",
          argsJson: JSON.stringify({
            paymentId: "11111111-1111-4111-8111-111111111111",
            phone: "+18095551234"
          }),
          summary: "Enviar el recibo del pago por WhatsApp al +18095551234.",
          status: "PENDING"
        }
      });

      const res = await adminCaller.copilotRejectAction({ actionId: action.id });
      expect(res.status).to.equal("REJECTED");
      expect(calls).to.have.lengthOf(0);
      expect(await db.businessEvent.count()).to.equal(0);
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
  // On-demand QCobro sync (issue #130)
  // ---------------------------------------------------------------------------

  describe("forceQCobroSync", () => {
    it("classifies forceQCobroSync as a write tool and binds it", () => {
      expect(isWriteTool("forceQCobroSync")).to.be.true;
      expect(getBoundToolNames()).to.include("forceQCobroSync");
    });

    it("summarizes the action with the fixed confirmation copy", () => {
      expect(summarizeAction("forceQCobroSync", {})).to.equal(
        "Forzar sincronización con QCobro ahora."
      );
    });

    it("a tool call is short-circuited into a PENDING action, nothing executes", async () => {
      const { admin, adminCaller } = await makeAdmin();
      const fake = makeFakeModel([
        {
          content: "Voy a sincronizar con QCobro.",
          tool_calls: [{ id: "c1", name: "forceQCobroSync", args: {} }]
        }
      ]);
      const { executor, calls } = makeRecordingExecutor();
      setCopilotDeps({ toolExecutor: executor, createModel: fake.factory });

      const reply = await adminCaller.copilotChat({ message: "sincroniza con QCobro ahora" });

      expect(calls, "no tool executed inline").to.have.lengthOf(0);
      expect(reply.pendingAction?.toolName).to.equal("forceQCobroSync");

      expect(await db.businessEvent.count()).to.equal(0);
      const pending = await db.copilotPendingAction.findMany({ where: { userId: admin.id } });
      expect(pending).to.have.lengthOf(1);
      expect(pending[0].status).to.equal("PENDING");
    });

    it("confirming runs the sync once and records qcobro.synced plus copilot.action", async () => {
      const { admin, adminCaller } = await makeAdmin();

      // A REAL executor wired the way index.ts wires it: the dependency runs
      // the sync and records its own qcobro.synced event (mirrors the cron
      // worker's tick), same as the cron/on-payment triggers already do.
      const syncStub = sinon.stub().resolves({
        customers: 8,
        portfoliosPushed: 2,
        portfoliosSkipped: 1,
        durationMs: 42
      });
      const realExecutor = createToolExecutor({
        forceQCobroSync: async (actorName?: string) => {
          const result = await syncStub();
          await recordQCobroSyncedEvent(db as any, result, actorName ?? "Fundador");
          return result;
        }
      } as any);
      setCopilotDeps({
        toolExecutor: realExecutor,
        createModel: makeFakeModel([{ content: "" }]).factory
      });

      const action = await db.copilotPendingAction.create({
        data: {
          userId: admin.id,
          toolName: "forceQCobroSync",
          argsJson: JSON.stringify({}),
          summary: "Forzar sincronización con QCobro ahora.",
          status: "PENDING"
        }
      });

      const res = await adminCaller.copilotConfirmAction({ actionId: action.id });
      expect(res.status).to.equal("CONFIRMED");
      expect(syncStub.calledOnce, "sync ran exactly once").to.be.true;

      const syncedEvents = await db.businessEvent.findMany({ where: { type: "qcobro.synced" } });
      expect(syncedEvents).to.have.lengthOf(1);
      const syncedPayload = JSON.parse(syncedEvents[0].payload);
      expect(syncedPayload).to.deep.equal({
        customers: 8,
        portfoliosPushed: 2,
        portfoliosSkipped: 1,
        durationMs: 42
      });

      const actionEvents = await db.businessEvent.findMany({ where: { type: "copilot.action" } });
      expect(actionEvents).to.have.lengthOf(1);
      expect(JSON.parse(actionEvents[0].payload).toolName).to.equal("forceQCobroSync");
    });

    it("rejecting runs no sync", async () => {
      const { admin, adminCaller } = await makeAdmin();
      const { executor, calls } = makeRecordingExecutor();
      setCopilotDeps({
        toolExecutor: executor,
        createModel: makeFakeModel([{ content: "" }]).factory
      });

      const action = await db.copilotPendingAction.create({
        data: {
          userId: admin.id,
          toolName: "forceQCobroSync",
          argsJson: JSON.stringify({}),
          summary: "Forzar sincronización con QCobro ahora.",
          status: "PENDING"
        }
      });

      const res = await adminCaller.copilotRejectAction({ actionId: action.id });
      expect(res.status).to.equal("REJECTED");
      expect(calls).to.have.lengthOf(0);
      expect(await db.businessEvent.count()).to.equal(0);
    });
  });

  // ---------------------------------------------------------------------------
  // createAccountingTransaction (mikro/#115, daily cash reconciliation)
  // ---------------------------------------------------------------------------

  describe("createAccountingTransaction", () => {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    /** Mirrors the name-or-UUID resolution index.ts wires for this dep. */
    async function resolveAccountRef(ref: string): Promise<string> {
      if (UUID_RE.test(ref)) return ref;
      const account = await db.accountingAccount.findFirst({ where: { name: ref } });
      if (!account) throw new Error(`Cuenta no encontrada: "${ref}"`);
      return account.id;
    }

    /** A REAL executor wired the way index.ts wires it, for confirm-flow tests. */
    function makeRealAccountingExecutor() {
      return createToolExecutor({
        createAccountingTransaction: async (
          params: {
            type: "DEPOSIT" | "WITHDRAWAL" | "EXPENSE" | "INCOME" | "TRANSFER";
            account: string;
            toAccount?: string;
            amount: number;
            category?: string;
            occurredAt?: Date;
          },
          createdById: string
        ) => {
          const accountId = await resolveAccountRef(params.account);
          const fn = createCreateTransaction(db as any);
          const txn = await fn({
            type: params.type,
            accountId,
            amount: params.amount,
            occurredAt: params.occurredAt ?? new Date(),
            createdById
          } as any);
          return {
            id: txn.id,
            type: txn.type,
            amount: txn.amount,
            account: txn.account.name,
            toAccount: txn.toAccount?.name ?? null,
            category: txn.category?.name ?? null
          };
        }
      } as any);
    }

    it("classifies createAccountingTransaction as a write tool and binds it", () => {
      expect(isWriteTool("createAccountingTransaction")).to.be.true;
      expect(getBoundToolNames()).to.include("createAccountingTransaction");
    });

    it("summarizes the action with type, amount, and account", () => {
      expect(
        summarizeAction("createAccountingTransaction", {
          type: "INCOME",
          amount: "1000",
          account: "Caja principal"
        })
      ).to.equal("Registrar un ingreso de RD$1000 en la cuenta Caja principal.");
    });

    it("a tool call is short-circuited into a PENDING action, nothing executes", async () => {
      const { admin, adminCaller } = await makeAdmin();
      const fake = makeFakeModel([
        {
          content: "Voy a registrar el cierre del día.",
          tool_calls: [
            {
              id: "c1",
              name: "createAccountingTransaction",
              args: { type: "INCOME", account: "Caja principal", amount: "1000" }
            }
          ]
        }
      ]);
      const { executor, calls } = makeRecordingExecutor();
      setCopilotDeps({ toolExecutor: executor, createModel: fake.factory });

      const reply = await adminCaller.copilotChat({
        message: "cierra el día, se cobraron 1000 en efectivo"
      });

      expect(calls, "no tool executed inline").to.have.lengthOf(0);
      expect(reply.pendingAction?.toolName).to.equal("createAccountingTransaction");
      expect(reply.pendingAction?.status).to.equal("PENDING");
      expect(await db.accountingTransaction.count()).to.equal(0);

      const pending = await db.copilotPendingAction.findMany({ where: { userId: admin.id } });
      expect(pending).to.have.lengthOf(1);
    });

    it("confirming resolves the account by name, posts the transaction, and records copilot.action", async () => {
      const { admin, adminCaller } = await makeAdmin();
      const account = await db.accountingAccount.create({
        data: { name: "Caja principal", kind: "CASH", currency: "DOP", currentBalance: 500 }
      });

      setCopilotDeps({
        toolExecutor: makeRealAccountingExecutor(),
        createModel: makeFakeModel([{ content: "" }]).factory
      });

      const action = await db.copilotPendingAction.create({
        data: {
          userId: admin.id,
          toolName: "createAccountingTransaction",
          argsJson: JSON.stringify({
            type: "INCOME",
            account: "Caja principal",
            amount: "1000"
          }),
          summary: "Registrar un ingreso de RD$1000 en la cuenta Caja principal.",
          status: "PENDING"
        }
      });

      const res = await adminCaller.copilotConfirmAction({ actionId: action.id });
      expect(res.status).to.equal("CONFIRMED");

      const txns = await db.accountingTransaction.findMany({ where: { accountId: account.id } });
      expect(txns).to.have.lengthOf(1);
      expect(Number(txns[0].amount)).to.equal(1000);
      expect(txns[0].type).to.equal("INCOME");

      const updatedAccount = await db.accountingAccount.findUnique({ where: { id: account.id } });
      expect(Number(updatedAccount?.currentBalance)).to.equal(1500);

      const events = await db.businessEvent.findMany({ where: { type: "copilot.action" } });
      expect(events).to.have.lengthOf(1);
      expect(JSON.parse(events[0].payload).toolName).to.equal("createAccountingTransaction");
    });

    it("confirming with an unknown account name refuses, nothing posted", async () => {
      const { admin, adminCaller } = await makeAdmin();
      setCopilotDeps({
        toolExecutor: makeRealAccountingExecutor(),
        createModel: makeFakeModel([{ content: "" }]).factory
      });

      const action = await db.copilotPendingAction.create({
        data: {
          userId: admin.id,
          toolName: "createAccountingTransaction",
          argsJson: JSON.stringify({
            type: "INCOME",
            account: "Cuenta que no existe",
            amount: "1000"
          }),
          summary: "Registrar un ingreso de RD$1000 en la cuenta Cuenta que no existe.",
          status: "PENDING"
        }
      });

      let threw = false;
      try {
        await adminCaller.copilotConfirmAction({ actionId: action.id });
      } catch {
        threw = true;
      }
      expect(threw, "confirm should throw on an unresolvable account").to.equal(true);
      expect(await db.accountingTransaction.count()).to.equal(0);
    });

    it("rejecting posts nothing", async () => {
      const { admin, adminCaller } = await makeAdmin();
      const { executor, calls } = makeRecordingExecutor();
      setCopilotDeps({
        toolExecutor: executor,
        createModel: makeFakeModel([{ content: "" }]).factory
      });

      const action = await db.copilotPendingAction.create({
        data: {
          userId: admin.id,
          toolName: "createAccountingTransaction",
          argsJson: JSON.stringify({
            type: "INCOME",
            account: "Caja principal",
            amount: "1000"
          }),
          summary: "Registrar un ingreso de RD$1000 en la cuenta Caja principal.",
          status: "PENDING"
        }
      });

      const res = await adminCaller.copilotRejectAction({ actionId: action.id });
      expect(res.status).to.equal("REJECTED");
      expect(calls).to.have.lengthOf(0);
      expect(await db.accountingTransaction.count()).to.equal(0);
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

    it("soft-deletes resolved action cards so they don't resurface after reload", async () => {
      const { admin, adminCaller } = await makeAdmin();
      await db.message.create({
        data: { role: "HUMAN", content: "registra un pago", userId: admin.id, channel: "copilot" }
      });
      await db.copilotPendingAction.create({
        data: {
          userId: admin.id,
          toolName: "createPayment",
          argsJson: JSON.stringify({ loanId: "10000", amount: "650" }),
          summary: "Registrar un pago.",
          status: "CONFIRMED",
          resolvedAt: new Date()
        }
      });

      await adminCaller.clearCopilotHistory({});

      const history = await adminCaller.getCopilotHistory({});
      expect(history.messages).to.have.lengthOf(0);
      expect(history.pendingActions).to.have.lengthOf(0);

      const rows = await db.copilotPendingAction.findMany({ where: { userId: admin.id } });
      expect(rows).to.have.lengthOf(1);
      expect(rows[0].deletedAt).to.not.equal(null);
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
