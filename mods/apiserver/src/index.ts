/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Load .env from project root in development
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter, createContext } from "./trpc/index.js";
import { ValidationError } from "@mikro/common";
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
  type Message
} from "@mikro/agents";
import { prisma } from "./db.js";
import { logger } from "./logger.js";
import {
  createGetUserByPhone,
  createGetMemberByPhone,
  createGetChatHistory,
  createAddMessageToChatHistory,
  createCreateMember,
  createCreatePayment,
  createGenerateReceipt,
  createListLoansByCollector,
  createListLoansByMember,
  createGetMember,
  createCreateLoan,
  createListUsers
} from "./api/index.js";
import { loadAgents, getAgent } from "./agents/index.js";

// Re-export AppRouter type for clients
export type { AppRouter } from "./trpc/index.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Images path for serving static files (receipts, etc.)
const IMAGES_PATH = process.env.IMAGES_PATH || "./images";

app.use(express.json());

// Serve images publicly at /images/:filename
app.use("/images", express.static(IMAGES_PATH));

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
app.post("/webhook", async (req, res) => {
  try {
    const result = await handleWhatsAppMessage(req.body);
    logger.verbose("whatsapp webhook processed", {
      messagesProcessed: result.messagesProcessed,
      senders: result.senders.length
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      logger.error("invalid webhook payload", { error: error.message });
    } else {
      const err = error as Error;
      logger.error("error processing webhook", { error: err.message });
    }
  }

  // Always return 200 to WhatsApp
  res.status(200).send("OK");
});

// Initialize message processor before starting server
async function initializeMessageProcessor() {
  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/23713f02-dc24-44ba-908b-cf00c268d600", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "index.ts:initializeMessageProcessor:entry",
      message: "initializing message processor",
      data: {},
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "A"
    })
  }).catch(() => {});
  logger.info("initializing message processor", { step: "entry" });
  // #endregion

  try {
    // Load agents
    logger.info("loading agents", { step: "load-agents" });
    const agents = loadAgents();
    logger.verbose("agents loaded", { count: agents.size });
    logger.info("agents loaded successfully", { count: agents.size, step: "agents-loaded" });

    // Create API functions
    const dbClient = prisma as unknown as Parameters<typeof createGetUserByPhone>[0];
    const getUserByPhone = createGetUserByPhone(dbClient);
    const getMemberByPhone = createGetMemberByPhone(dbClient);
    const getChatHistory = createGetChatHistory(dbClient);
    const addMessageToChatHistory = createAddMessageToChatHistory(dbClient);
    const createMember = createCreateMember(dbClient);
    const createPayment = createCreatePayment(dbClient);
    const generateReceipt = createGenerateReceipt({ db: dbClient });
    const listLoansByCollector = createListLoansByCollector(dbClient);
    const listLoansByMember = createListLoansByMember(dbClient);
    const getMember = createGetMember(dbClient);
    const createLoan = createCreateLoan(dbClient);
    const listUsers = createListUsers(dbClient);

    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/23713f02-dc24-44ba-908b-cf00c268d600", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "index.ts:initializeMessageProcessor:api-functions",
        message: "api functions created",
        data: { functionsCreated: 10 },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "A"
      })
    }).catch(() => {});
    // #endregion

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
      getMemberByPhone: async (params: { phone: string }) => {
        const member = await getMemberByPhone(params);
        if (!member || !member.phone) return null;
        return {
          id: member.id,
          name: member.name,
          phone: member.phone,
          isActive: member.isActive
        };
      }
    });

    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/23713f02-dc24-44ba-908b-cf00c268d600", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "index.ts:initializeMessageProcessor:router",
        message: "router created",
        data: {},
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "A"
      })
    }).catch(() => {});
    // #endregion

    // Create tool executor
    const toolExecutor = createToolExecutor({
      createMember: async (params) => {
        const member = await createMember(params);
        return { id: member.id, name: member.name, phone: member.phone };
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
      createPayment: async (params) => {
        const payment = await createPayment(params);
        return { id: payment.id, amount: payment.amount };
      },
      generateReceipt: async (params) => {
        const receipt = await generateReceipt(params);
        return { image: receipt.image, token: receipt.token };
      },
      listLoansByCollector: async (params) => {
        const loans = await listLoansByCollector(params);
        return loans.map((loan) => ({
          id: loan.id,
          loanId: loan.loanId,
          principal: loan.principal,
          status: loan.status
        }));
      },
      getMember: async (params) => {
        const member = await getMember(params);
        return member ? { id: member.id, name: member.name, phone: member.phone } : null;
      },
      getMemberByPhone: async (params) => {
        const member = await getMemberByPhone(params);
        return member ? { id: member.id, name: member.name, phone: member.phone } : null;
      },
      listLoansByMember: async (params) => {
        const loans = await listLoansByMember(params);
        return loans.map((loan) => ({
          id: loan.id,
          loanId: loan.loanId,
          principal: loan.principal,
          status: loan.status
        }));
      },
      createLoan: async (params) => {
        const loan = await createLoan(params);
        return { id: loan.id, loanId: loan.loanId };
      }
    });

    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/23713f02-dc24-44ba-908b-cf00c268d600", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "index.ts:initializeMessageProcessor:tool-executor",
        message: "tool executor created",
        data: {},
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "A"
      })
    }).catch(() => {});
    // #endregion

    // Create WhatsApp client
    const whatsAppClient = createWhatsAppClient();
    const sendWhatsAppMessage = createSendWhatsAppMessage(whatsAppClient);

    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/23713f02-dc24-44ba-908b-cf00c268d600", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "index.ts:initializeMessageProcessor:whatsapp-client",
        message: "whatsapp client created",
        data: {},
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "A"
      })
    }).catch(() => {});
    // #endregion

    // Create LLM invoker wrapper that selects agent based on name
    const invokeLLM = async (
      agent: Parameters<typeof createInvokeLLM>[0],
      messages: Message[],
      userMessage: string,
      imageUrl?: string | null,
      context?: Record<string, unknown>
    ): Promise<string> => {
      const invokeFn = createInvokeLLM(agent, allTools, toolExecutor);
      return invokeFn(messages, userMessage, imageUrl, context);
    };

    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/23713f02-dc24-44ba-908b-cf00c268d600", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "index.ts:initializeMessageProcessor:llm-invoker",
        message: "llm invoker created",
        data: {},
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "A"
      })
    }).catch(() => {});
    // #endregion

    // Helper to get chat history for a user (convert DB messages to LLM Message format)
    const getChatHistoryForUser = async (userId: string): Promise<Message[]> => {
      const dbMessages = await getChatHistory({ userId, limit: 100 });
      return dbMessages.map((msg) => ({
        role: msg.role === "AI" ? "assistant" : msg.role === "HUMAN" ? "user" : "system",
        content: msg.content
      }));
    };

    // Helper to add message for a user
    const addMessageForUser = async (params: {
      userId: string;
      role: "AI" | "HUMAN";
      content: string;
    }): Promise<void> => {
      await addMessageToChatHistory({
        userId: params.userId,
        role: params.role,
        content: params.content
      });
    };

    // Configure message processor
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/23713f02-dc24-44ba-908b-cf00c268d600", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "index.ts:initializeMessageProcessor:before-set-processor",
        message: "about to call setMessageProcessor",
        data: {
          hasRouteMessage: !!routeMessage,
          hasInvokeLLM: !!invokeLLM,
          hasSendWhatsAppMessage: !!sendWhatsAppMessage
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "A"
      })
    }).catch(() => {});
    logger.info("calling setMessageProcessor", {
      step: "before-set-processor",
      hasRouteMessage: !!routeMessage,
      hasInvokeLLM: !!invokeLLM,
      hasSendWhatsAppMessage: !!sendWhatsAppMessage
    });
    // #endregion

    const processorConfig = {
      routeMessage,
      invokeLLM,
      sendWhatsAppMessage,
      downloadMedia: whatsAppClient.downloadMedia.bind(whatsAppClient),
      getChatHistoryForUser,
      addMessageForUser,
      getAgent: (name: "joan" | "juan" | "maria") => getAgent(agents, name)
    };

    setMessageProcessor(processorConfig);

    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/23713f02-dc24-44ba-908b-cf00c268d600", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "index.ts:initializeMessageProcessor:after-set-processor",
        message: "setMessageProcessor completed",
        data: {},
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "A"
      })
    }).catch(() => {});
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
    // #endregion

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
        imagesPath: IMAGES_PATH,
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
