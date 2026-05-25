/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Load .env so MIKRO_CONFIG_FILE can point to mikro.json
const __dirname = dirname(fileURLToPath(import.meta.url));
// From mods/apiserver/dist or mods/apiserver/src, go up to repo root for .env and default mikro.json
const repoRoot = resolve(__dirname, "../../..");
loadDotenv({ path: resolve(repoRoot, ".env") });
// Default config file to repo root so it works when running from mods/apiserver (e.g. npm run start)
if (!process.env.MIKRO_CONFIG_FILE) {
  process.env.MIKRO_CONFIG_FILE = resolve(repoRoot, "mikro.json");
}

import { getConfig, getLogoPath } from "@mikro/common";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter, createContext } from "./trpc/index.js";
import {
  ValidationError,
  renderCustomersReportToPng,
  loadLogoDataUrl,
  MAX_TRPC_REQUEST_BYTES
} from "@mikro/common";
import type { CalculateLoanInput } from "@mikro/common";
import {
  handleWhatsAppMessage,
  getWebhookVerifyToken,
  setMessageProcessor,
  getMessageProcessorState,
  markInitializationComplete,
  createMessageRouter,
  createInvokeLLM,
  createToolExecutor,
  createSendWhatsAppMessage,
  createWhatsAppClient,
  allTools,
  getDisabledAgents,
  getVoiceNotesEnabled,
  getDeepgramApiKey,
  initializeLLM,
  type Message,
  type AgentName,
  type ToolExecutorDependencies,
  type ExportedCustomer
} from "@mikro/agents";
import { prisma } from "./db.js";
import { logger } from "./logger.js";

process.on("uncaughtException", (err) => {
  logger.error("uncaught exception – shutting down", { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  logger.error("unhandled promise rejection", { reason: message });
});

import {
  createGetUserByPhone,
  createGetCustomerByPhone,
  createAddMessageToChatHistory,
  createCreateCustomer,
  createCreatePayment,
  createGenerateReceipt,
  createSendReceiptViaWhatsApp,
  createListLoansByCollector,
  createListLoansByCustomer,
  createListPaymentsByLoanId,
  createGetLoanByLoanId,
  createPreviewLateFee,
  createGetCustomer,
  createCreateLoan,
  createCalculateLoan,
  createUpdateLoanStatus,
  createListUsers,
  createExportCollectorCustomers,
  createExportCustomersByReferrer,
  createExportAllCustomers,
  createGeneratePerformanceReport,
  createGenerateDefaultedReport,
  createGenerateRenewalCandidatesReport
} from "./api/index.js";
import { loadAgents, getAgent } from "./agents/index.js";
import { createTranscribeVoiceNote } from "./voice/createTranscribeVoiceNote.js";

// Re-export AppRouter type for clients
export type { AppRouter } from "./trpc/index.js";

const app = express();
const cfg = getConfig();
const PORT = cfg.port;

// The /trpc endpoint accepts transaction attachments inline as base64, so its
// JSON body can be much larger than Express's 100kb default. Apply a dedicated
// parser for /trpc before the global one (body-parser is a no-op once req.body
// is populated, so the global parser below still handles everything else).
app.use("/trpc", express.json({ limit: MAX_TRPC_REQUEST_BYTES }));
app.use(express.json());

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// tRPC API
app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext
  })
);

// WhatsApp webhook verification (GET)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"] as string | undefined;
  const token = req.query["hub.verify_token"] as string | undefined;
  const challenge = req.query["hub.challenge"] as string | undefined;

  const verifyToken = getWebhookVerifyToken();

  if (mode === "subscribe" && token === verifyToken) {
    logger.verbose("whatsapp webhook verified successfully");
    res.status(200).send(challenge);
  } else {
    logger.warn("whatsapp webhook verification failed", { mode, token });
    res.sendStatus(403);
  }
});

// WhatsApp webhook messages (POST)
// Return 200 immediately so WhatsApp does not retry; process messages asynchronously.
app.post("/webhook", (req, res) => {
  const body = req.body;
  res.status(200).send("OK");

  handleWhatsAppMessage(body)
    .then((result) => {
      logger.verbose("whatsapp webhook processed", {
        messagesProcessed: result.messagesProcessed,
        senders: result.senders.length
      });
    })
    .catch((error: unknown) => {
      if (error instanceof ValidationError) {
        logger.error("invalid webhook payload", { error: error.message });
      } else {
        const err = error as Error;
        logger.error("error processing webhook", { error: err.message });
      }
    });
});

// Initialize message processor before starting server
async function initializeMessageProcessor() {
  logger.info("initializing message processor", { step: "entry" });

  try {
    // Validate LLM configurations first (fail fast on misconfiguration)
    logger.info("validating LLM configurations", { step: "validate-llm" });
    initializeLLM();
    logger.info("LLM configurations validated", { step: "llm-validated" });

    // Load agents
    logger.info("loading agents", { step: "load-agents" });
    const agents = loadAgents();
    logger.verbose("agents loaded", { count: agents.size });
    logger.info("agents loaded successfully", { count: agents.size, step: "agents-loaded" });

    // Create API functions
    const dbClient = prisma as unknown as Parameters<typeof createGetUserByPhone>[0];
    const getUserByPhone = createGetUserByPhone(dbClient);
    const getCustomerByPhone = createGetCustomerByPhone(dbClient);
    const addMessageToChatHistory = createAddMessageToChatHistory(dbClient);
    const createCustomer = createCreateCustomer(dbClient);
    const createPayment = createCreatePayment(dbClient);
    const generateReceipt = createGenerateReceipt({ db: dbClient });
    const listLoansByCollector = createListLoansByCollector(dbClient);
    const listLoansByCustomer = createListLoansByCustomer(dbClient);
    const listPaymentsByLoanId = createListPaymentsByLoanId(dbClient);
    const getLoanByLoanId = createGetLoanByLoanId(dbClient);
    const previewLateFee = createPreviewLateFee(dbClient);
    const getCustomer = createGetCustomer(dbClient);
    const createLoan = createCreateLoan(dbClient);
    const calculateLoan = createCalculateLoan();
    const updateLoanStatus = createUpdateLoanStatus(dbClient);
    const listUsers = createListUsers(dbClient);
    const exportCollectorCustomers = createExportCollectorCustomers(dbClient);
    const exportCustomersByReferrer = createExportCustomersByReferrer(dbClient);
    const exportAllCustomers = createExportAllCustomers(dbClient);
    const generatePerformanceReport = createGeneratePerformanceReport(dbClient);
    const generateDefaultedReport = createGenerateDefaultedReport(dbClient);
    const generateRenewalCandidatesReport = createGenerateRenewalCandidatesReport(dbClient);
    // Create WhatsApp client (needed for sendReceiptViaWhatsApp)
    const whatsAppClient = createWhatsAppClient();
    const sendWhatsAppMessage = createSendWhatsAppMessage(whatsAppClient);

    // Create send receipt via WhatsApp function
    const sendReceiptViaWhatsAppFn = createSendReceiptViaWhatsApp({
      db: dbClient,
      generateReceipt,
      sendWhatsAppMessage,
      uploadMedia: whatsAppClient.uploadMedia.bind(whatsAppClient)
    });

    // Get disabled agents from config
    const disabledAgents = getDisabledAgents();
    logger.verbose("disabled agents loaded", { disabledAgents: Array.from(disabledAgents) });

    // Create function to check if an agent is disabled
    const isAgentDisabled = (agentName: AgentName): boolean => {
      return disabledAgents.has(agentName);
    };

    // Create router
    const routeMessage = createMessageRouter({
      getUserByPhone: async (params: { phone: string }) => {
        const user = await getUserByPhone(params);
        if (!user || !user.phone) return null;
        return {
          id: user.id,
          name: user.name,
          phone: user.phone,
          enabled: user.enabled,
          roles: user.roles
        };
      },
      getCustomerByPhone: async (params: { phone: string }) => {
        const customer = await getCustomerByPhone(params);
        if (!customer || !customer.phone) return null;
        return {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          isActive: customer.isActive
        };
      },
      isAgentDisabled
    });

    const toExportedCustomer = (customer: {
      name: string;
      nickname?: string | null;
      phone: string;
      collectionPoint?: string | null;
      notes?: string | null;
      preferredPaymentDay?: string | null;
      referredBy?: { name: string } | null;
      loans: Array<{
        loanId: number;
        nickname?: string | null;
        paymentFrequency: string;
        createdAt: Date;
        termLength: number;
        payments: Array<{ paidAt: Date }>;
      }>;
    }): ExportedCustomer => ({
      name: customer.name,
      nickname: customer.nickname ?? null,
      phone: customer.phone,
      collectionPoint: customer.collectionPoint ?? null,
      notes: customer.notes ?? null,
      preferredPaymentDay: customer.preferredPaymentDay ?? null,
      referredBy: customer.referredBy ? { name: customer.referredBy.name } : null,
      loans: customer.loans.map((loan) => ({
        loanId: loan.loanId,
        notes: null,
        nickname: loan.nickname ?? null,
        paymentFrequency: loan.paymentFrequency,
        createdAt: loan.createdAt,
        termLength: loan.termLength,
        payments: loan.payments.map((p) => ({ paidAt: p.paidAt }))
      }))
    });

    const toolExecutor = createToolExecutor({
      createCustomer: async (params: Parameters<ToolExecutorDependencies["createCustomer"]>[0]) => {
        const customer = await createCustomer(params);
        return { id: customer.id, name: customer.name, phone: customer.phone };
      },
      listUsers: async (params?: { role?: "ADMIN" | "COLLECTOR" | "REFERRER" }) => {
        const allUsers = await listUsers({});
        // Filter by role if provided
        let filteredUsers = allUsers;
        if (params?.role) {
          filteredUsers = allUsers.filter((u) => u.roles?.some((r) => r.role === params.role));
        }
        return filteredUsers.map((u) => ({
          id: u.id,
          name: u.name,
          phone: u.phone ?? "",
          roles: u.roles?.map((r) => ({ role: String(r.role) }))
        }));
      },
      createPayment: async (params: Parameters<ToolExecutorDependencies["createPayment"]>[0]) => {
        const res = await createPayment(params);
        return {
          installment: res.installment
            ? { id: res.installment.id, amount: res.installment.amount }
            : null,
          lateFee: res.lateFee ? { id: res.lateFee.id, amount: res.lateFee.amount } : null
        };
      },
      generateReceipt: async (
        params: Parameters<ToolExecutorDependencies["generateReceipt"]>[0]
      ) => {
        const receipt = await generateReceipt(params);
        return { image: receipt.image, token: receipt.token };
      },
      sendReceiptViaWhatsApp: async (params: { paymentId: string; phone: string }) => {
        const result = await sendReceiptViaWhatsAppFn({
          paymentId: params.paymentId,
          phone: params.phone
        });
        return {
          success: result.success,
          message: result.success
            ? `Recibo enviado correctamente.${result.messageId ? ` ID del mensaje: ${result.messageId}` : ""}`
            : `Error al enviar el recibo: ${result.error || "Error desconocido"}`,
          messageId: result.messageId,
          error: result.error
        };
      },
      listLoansByCollector: async (
        params: Parameters<ToolExecutorDependencies["listLoansByCollector"]>[0]
      ) => {
        const loans = await listLoansByCollector(params);
        return loans.map((loan) => ({
          id: loan.id,
          loanId: loan.loanId,
          principal: loan.principal,
          status: loan.status
        }));
      },
      getCustomer: async (params: Parameters<ToolExecutorDependencies["getCustomer"]>[0]) => {
        const customer = await getCustomer(params);
        return customer ? { id: customer.id, name: customer.name, phone: customer.phone } : null;
      },
      getCustomerByPhone: async (
        params: Parameters<ToolExecutorDependencies["getCustomerByPhone"]>[0]
      ) => {
        const customer = await getCustomerByPhone(params);
        return customer ? { id: customer.id, name: customer.name, phone: customer.phone } : null;
      },
      listLoansByCustomer: async (
        params: Parameters<ToolExecutorDependencies["listLoansByCustomer"]>[0]
      ) => {
        const loans = await listLoansByCustomer(params);
        return loans.map((loan) => ({
          id: loan.id,
          loanId: loan.loanId,
          principal: loan.principal,
          status: loan.status
        }));
      },
      listPaymentsByLoanId: async (
        params: Parameters<ToolExecutorDependencies["listPaymentsByLoanId"]>[0]
      ) => {
        const payments = await listPaymentsByLoanId(params);
        return payments.map((payment) => ({
          id: payment.id,
          amount: Number(payment.amount),
          paidAt: payment.paidAt,
          status: payment.status,
          method: payment.method
        }));
      },
      createLoan: async (params: Parameters<ToolExecutorDependencies["createLoan"]>[0]) => {
        const loan = await createLoan(params);
        return { id: loan.id, loanId: loan.loanId };
      },
      calculateLoan: async (params: CalculateLoanInput) => {
        const result = await calculateLoan(params);
        return result as Awaited<ReturnType<ToolExecutorDependencies["calculateLoan"]>>;
      },
      updateLoanStatus: async (
        params: Parameters<ToolExecutorDependencies["updateLoanStatus"]>[0]
      ) => {
        return updateLoanStatus(params);
      },
      getLoanByLoanId: async (params: { loanId: number }) => {
        const loan = await getLoanByLoanId(params);
        if (!loan) {
          return null;
        }
        return {
          id: loan.id,
          loanId: loan.loanId,
          principal: Number(loan.principal),
          termLength: loan.termLength,
          paymentAmount: Number(loan.paymentAmount),
          paymentFrequency: loan.paymentFrequency,
          status: loan.status,
          nickname: loan.nickname ?? null,
          customer: {
            id: loan.customer.id,
            name: loan.customer.name,
            nickname: loan.customer.nickname ?? null,
            phone: loan.customer.phone,
            assignedCollectorId: loan.customer.assignedCollectorId
          }
        } as Awaited<ReturnType<ToolExecutorDependencies["getLoanByLoanId"]>>;
      },
      previewLateFee: async (params: { loanId: number; asOf?: Date }) => {
        return previewLateFee(params);
      },
      exportCollectorCustomers: async (
        params: Parameters<ToolExecutorDependencies["exportCollectorCustomers"]>[0]
      ) => {
        const customers = await exportCollectorCustomers(params);
        return customers.map(toExportedCustomer);
      },
      exportCustomersByReferrer: async (
        params: Parameters<ToolExecutorDependencies["exportCustomersByReferrer"]>[0]
      ) => {
        const customers = await exportCustomersByReferrer(params);
        return customers.map(toExportedCustomer);
      },
      exportAllCustomers: async () => {
        const customers = await exportAllCustomers({});
        return customers.map(toExportedCustomer);
      },
      generatePerformanceReport: async (params: { startDate?: string; endDate?: string }) => {
        const result = await generatePerformanceReport({
          startDate: params.startDate ? new Date(params.startDate) : undefined,
          endDate: params.endDate ? new Date(params.endDate) : undefined
        });
        return { image: result.image };
      },
      generateDefaultedReport: async () => {
        const result = await generateDefaultedReport({});
        return { image: result.image };
      },
      generateRenewalCandidatesReport: async () => {
        const result = await generateRenewalCandidatesReport({});
        return { image: result.image };
      },
      renderCustomersReportToPng: async (
        customers: Parameters<ToolExecutorDependencies["renderCustomersReportToPng"]>[0]
      ) => {
        const logoDataUrl = loadLogoDataUrl(getLogoPath());
        return renderCustomersReportToPng(customers, undefined, logoDataUrl ?? undefined);
      },
      uploadMedia: async (fileBuffer: Buffer, mimeType: string) => {
        return whatsAppClient.uploadMedia(fileBuffer, mimeType);
      },
      sendWhatsAppMessage: async (
        params: Parameters<ToolExecutorDependencies["sendWhatsAppMessage"]>[0]
      ) => {
        return sendWhatsAppMessage(params);
      }
    });

    // Generic ack messages sent before slow tool execution (no LLM involved)
    const QUICK_ACK_MESSAGES = [
      "Claro que sí, un momento.",
      "Un momento por favor.",
      "Permíteme un momento.",
      "Enseguida.",
      "¡Ok, un momento por favor!",
      "Dame un segundo.",
      "Si claro, un momento por favor."
    ];

    function pickRandomAck(): string {
      return QUICK_ACK_MESSAGES[Math.floor(Math.random() * QUICK_ACK_MESSAGES.length)];
    }

    // Create LLM invoker wrapper that selects agent based on name
    const invokeLLM = async (
      agent: Parameters<typeof createInvokeLLM>[0],
      messages: Message[],
      userMessage: string,
      imageUrl?: string | null,
      context?: Record<string, unknown>,
      isNewSession?: boolean
    ) => {
      const invokeFn = createInvokeLLM(agent, allTools, toolExecutor, {
        sendQuickAck: async (ctx) => {
          const phone = ctx.phone as string | undefined;
          if (phone) {
            await sendWhatsAppMessage({ phone, message: pickRandomAck() });
          }
        }
      });
      return invokeFn(messages, userMessage, imageUrl, context, isNewSession ?? true);
    };

    // Helper to get chat history for a user (convert DB messages to LLM Message format)
    // Gets the most recent messages to avoid token limit issues
    const getChatHistoryForUser = async (userId: string): Promise<Message[]> => {
      // Query directly to get most recent 20 messages (ordered by desc, then reverse for chronological order)
      // This prevents token limit errors from very long chat histories
      const dbMessages = await dbClient.message.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20 // Get only the 20 most recent messages
      });

      // Reverse to get chronological order (oldest to newest) for LLM context
      const chronologicalMessages = [...dbMessages].reverse();

      return chronologicalMessages.map((msg) => {
        const role = msg.role === "AI" ? "assistant" : msg.role === "HUMAN" ? "user" : "system";
        const tools_executed =
          msg.role === "AI" && msg.tools
            ? (JSON.parse(msg.tools) as string[]).map((name) => ({
                name,
                args: {} as Record<string, unknown>
              }))
            : undefined;
        return {
          role,
          content: msg.content,
          ...(tools_executed && { tools_executed })
        };
      });
    };

    // Helper to add message for a user
    const addMessageForUser = async (params: {
      userId: string;
      role: "AI" | "HUMAN";
      content: string;
      tools?: string[];
    }): Promise<void> => {
      await addMessageToChatHistory({
        userId: params.userId,
        role: params.role,
        content: params.content,
        tools: params.tools
      });
    };

    // Configure message processor
    logger.info("calling setMessageProcessor", {
      step: "before-set-processor",
      hasRouteMessage: !!routeMessage,
      hasInvokeLLM: !!invokeLLM,
      hasSendWhatsAppMessage: !!sendWhatsAppMessage
    });

    const voiceNotesEnabled = getVoiceNotesEnabled();
    const deepgramApiKey = getDeepgramApiKey();
    const transcribeVoiceNote =
      voiceNotesEnabled && deepgramApiKey ? createTranscribeVoiceNote(deepgramApiKey) : undefined;
    if (voiceNotesEnabled && !deepgramApiKey) {
      logger.warn(
        "voice notes enabled but MIKRO_DEEPGRAM_API_KEY not set; voice notes will be unavailable"
      );
    }

    const processorConfig = {
      routeMessage,
      invokeLLM,
      sendWhatsAppMessage,
      downloadMedia: whatsAppClient.downloadMedia.bind(whatsAppClient),
      getChatHistoryForUser,
      addMessageForUser,
      getAgent: (name: AgentName) => getAgent(agents, name),
      ...(transcribeVoiceNote && { transcribeVoiceNote })
    };

    setMessageProcessor(processorConfig);

    logger.info("setMessageProcessor completed", { step: "after-set-processor" });

    // Verify processor was set
    const processorState = getMessageProcessorState();
    logger.info("message processor state after setting", {
      step: "verify-processor",
      processorState,
      processorExists: processorState.exists
    });
    if (!processorState.exists) {
      throw new Error("Message processor was not set successfully");
    }

    // Mark initialization as complete
    markInitializationComplete();
    const finalProcessorState = getMessageProcessorState();
    logger.info("initialization marked as complete", { finalProcessorState });

    logger.verbose("message processor configured successfully");
    logger.info("message processor initialization complete", { step: "complete" });
  } catch (error) {
    const err = error as Error;
    logger.error("failed to initialize message processor", { error: err.message });
    throw error;
  }
}

// Initialize message processor, then start server
initializeMessageProcessor()
  .then(() => {
    // Verify processor is set before starting server
    const finalState = getMessageProcessorState();
    logger.info("final processor state before server start", { finalState });

    if (!finalState.exists) {
      logger.error("message processor not set - server will not process messages", { finalState });
      throw new Error("Message processor was not set during initialization");
    }

    // Double-check by importing again (to test module isolation)
    import("@mikro/agents")
      .then((agentsModule) => {
        const importedState = agentsModule.getMessageProcessorState();
        logger.info("processor state from re-imported module", { importedState });
        if (!importedState.exists) {
          logger.error(
            "processor not accessible from re-imported module - possible module isolation issue"
          );
        }
      })
      .catch((err) => {
        logger.warn("could not verify processor from re-import", { error: (err as Error).message });
      });

    app.listen(PORT, () => {
      logger.info("api server started", {
        port: PORT,
        processorConfigured: finalState.exists
      });

      // Final verification after server starts
      const postStartState = getMessageProcessorState();
      logger.info("processor state after server start", { postStartState });
    });
  })
  .catch((error) => {
    logger.error("failed to start server", {
      error: (error as Error).message,
      stack: (error as Error).stack
    });
    process.exit(1);
  });
