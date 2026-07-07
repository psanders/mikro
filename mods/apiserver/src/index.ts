/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve, join } from "path";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { createHash, randomUUID } from "crypto";

// Load .env so MIKRO_CONFIG_FILE can point to mikro.json
const __dirname = dirname(fileURLToPath(import.meta.url));
// From mods/apiserver/dist or mods/apiserver/src, go up to repo root for .env and default mikro.json
const repoRoot = resolve(__dirname, "../../..");
loadDotenv({ path: resolve(repoRoot, ".env") });
// Default config file to repo root so it works when running from mods/apiserver (e.g. npm run start)
if (!process.env.MIKRO_CONFIG_FILE) {
  process.env.MIKRO_CONFIG_FILE = resolve(repoRoot, "mikro.json");
}

import {
  getConfig,
  getLogoPath,
  getPromoBannerPath,
  getFollowUpTimerConfig,
  getWhatsAppFollowUpTemplate,
  LOAN_APPLICATION_PROMO_ASSET_ROUTE,
  RECEIPT_ROUTE_PREFIX,
  UPDATES_MANIFEST_ROUTE,
  UPDATES_ASSET_ROUTE_PREFIX,
  getUpdatesConfig,
  resolvePathFromConfigDir,
  loadPublicKey,
  verifyReceiptToken,
  renderReceiptCardWithToken
} from "@mikro/common";
import { createGetManifestPath, createResolveAssetPath } from "./updates/index.js";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter, createContext } from "./trpc/index.js";
import {
  ValidationError,
  renderCustomersReportToPng,
  loadLogoDataUrl,
  MAX_TRPC_REQUEST_BYTES,
  applicationPayloadSchema,
  normalizeApplication
} from "@mikro/common";
import type { CalculateLoanInput, DbClient } from "@mikro/common";
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
  getVoiceNotesEnabled,
  getDeepgramApiKey,
  initializeLLM,
  getAgentByProfile,
  createChatModel,
  getLLMConfig,
  getWhatsAppPromoTemplate,
  type Message,
  type Profile,
  type ToolExecutorDependencies,
  type ExportedCustomer
} from "@mikro/agents";
import { setCopilotDeps, createWatchRuleEvaluator } from "./api/copilot/index.js";
import { createTaskWorker } from "./tasks/index.js";
import { createSendApplicationPromo } from "./api/applications/createSendApplicationPromo.js";
import { createGetApplication } from "./api/applications/createGetApplication.js";
import {
  createApproveApplication,
  createRejectApplication,
  createDeleteApplication
} from "./api/applications/index.js";
import { Octokit } from "@octokit/rest";
import { fileGithubIssue } from "./api/feedback/fileGithubIssue.js";
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
  createExportAllCustomers,
  createGeneratePerformanceReport,
  createGenerateDefaultedReport,
  createGenerateRenewalCandidatesReport,
  createUpsertApplication,
  createFindLatestApplicationByPhone,
  createGetApplicationByPhone,
  createSubmitApplicationFromFlow,
  createRecordOutboundMessage,
  createUpdateOutboundStatus
} from "./api/index.js";
import {
  createScheduleFollowUpJob,
  createSendFollowUpNudge,
  createFollowUpWorker
} from "./follow-up/index.js";
import { createSyncAllPortfolios, createQCobroWorker } from "./qcobro/index.js";
import {
  createGetApplicationState,
  createSaveAnswer,
  createFinalizeApplication
} from "./api/jose/index.js";
import { loadAgents } from "./agents/index.js";
import { createTranscribeVoiceNote } from "./voice/createTranscribeVoiceNote.js";

// Re-export AppRouter type for clients
export type { AppRouter } from "./trpc/index.js";

const app = express();
const cfg = getConfig();
const PORT = cfg.port;

// CORS for browser-based clients: the ops dashboard web build and the Tauri
// webview send a cross-origin `Origin`; native clients (mobile/CLI) do not and
// are unaffected. Allowed origins come from config (`corsAllowedOrigins`). We
// echo the specific origin (never `*`) with `Vary: Origin`, allow the
// Authorization header used for Bearer auth, and answer the preflight `OPTIONS`
// before body parsing/routes. tRPC uses a header token (no cookies), so no
// credentials flag is needed.
const allowedOrigins = new Set(cfg.corsAllowedOrigins);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// The /trpc endpoint accepts transaction attachments inline as base64, so its
// JSON body can be much larger than Express's 100kb default. Apply a dedicated
// parser for /trpc before the global one (body-parser is a no-op once req.body
// is populated, so the global parser below still handles everything else).
app.use("/trpc", express.json({ limit: MAX_TRPC_REQUEST_BYTES }));
// Public application intake: small body cap (a solicitud is a few KB of text).
app.use("/v1/applications", express.json({ limit: "32kb" }));
app.use(express.json());

// Health check endpoint. Reports the running version so deploys can verify
// the expected image actually came up.
const apiserverVersion: string = JSON.parse(
  readFileSync(resolve(__dirname, "../package.json"), "utf8")
).version;
app.get("/health", (_req, res) => {
  res.json({ status: "ok", version: apiserverVersion });
});

// Public promo banner — UNAUTHENTICATED. The `loan_application` WhatsApp template
// has an image header that WhatsApp fetches by URL at send time; serve the bundled
// banner here so we don't depend on an external host. A single-file route (not a
// static mount) keeps the rest of assets/ (Flow JSON, fonts) private.
app.get(LOAN_APPLICATION_PROMO_ASSET_ROUTE, (_req, res) => {
  res.sendFile(getPromoBannerPath(), (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
});

// Public verifiable receipt image — UNAUTHENTICATED. The payment-confirmation
// WhatsApp template uses this as its image header (fetched by URL at send time)
// and as its "Descargar recibo" button target. The signed token is self-
// contained, so we verify + render the landscape card with no DB lookup.
// Rendered cards are cached on disk (keyed by token hash) so repeat fetches —
// WhatsApp's header fetch plus every recipient open — don't re-render.
const receiptPublicKey = loadPublicKey(resolvePathFromConfigDir(getConfig().keysPath));
const receiptCardCacheDir = resolvePathFromConfigDir(join(getConfig().receiptsPath, "cards"));

app.get(`${RECEIPT_ROUTE_PREFIX}/:token`, async (req, res) => {
  const { token } = req.params;

  let receiptData;
  try {
    receiptData = verifyReceiptToken(token, receiptPublicKey);
  } catch {
    // Invalid signature or expired token — don't reveal which.
    res.status(404).end();
    return;
  }

  try {
    const cacheKey = createHash("sha256").update(token).digest("hex");
    const cachePath = join(receiptCardCacheDir, `${cacheKey}.png`);
    let png: Buffer;
    if (existsSync(cachePath)) {
      png = readFileSync(cachePath);
    } else {
      png = await renderReceiptCardWithToken(receiptData, token, logger);
      mkdirSync(receiptCardCacheDir, { recursive: true });
      writeFileSync(cachePath, png);
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", `inline; filename="recibo-${receiptData.loanNumber}.png"`);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.end(png);
  } catch (err) {
    logger.error("failed to render receipt card", { error: (err as Error).message });
    if (!res.headersSent) res.status(500).end();
  }
});

// Desktop auto-update endpoints — UNAUTHENTICATED (the updater runs before
// login). The manifest route serves the signed latest.json from the deploy-
// populated updates folder; the asset route serves a named installer from the
// same folder. Off unless `updates.enabled` is set. Safety rests on the signed
// manifest + client-side pubkey check, not the transport.
if (getUpdatesConfig().enabled) {
  const updatesCfg = getUpdatesConfig();
  const updatesDir = resolvePathFromConfigDir(updatesCfg.path);
  const updateServiceConfig = {
    updatesDir,
    manifestFilename: updatesCfg.manifestFilename
  };
  const getManifestPath = createGetManifestPath(updateServiceConfig);
  const resolveAssetPath = createResolveAssetPath(updateServiceConfig);

  app.get(UPDATES_MANIFEST_ROUTE, (_req, res) => {
    const manifestPath = getManifestPath();
    // 204 is the Tauri updater's "no update available" signal.
    if (!manifestPath) {
      res.status(204).end();
      return;
    }
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(manifestPath, (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
  });

  app.get(`${UPDATES_ASSET_ROUTE_PREFIX}/:name`, (req, res) => {
    const assetPath = resolveAssetPath(req.params.name);
    if (!assetPath) {
      res.status(404).end();
      return;
    }
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.sendFile(assetPath, (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
  });

  logger.info("desktop auto-update endpoints enabled", { updatesDir });
}

// Public loan application (solicitud) intake — UNAUTHENTICATED. The public
// website form posts here (partial autosaves + a final submit), all keyed by a
// client-generated `sessionId`. We normalize and upsert by session. We always
// respond `{ result: "ok" }` on success (the form expects that shape) and never
// leak schema details; only a genuine DB failure returns 500 so the form can
// show its connection-error message.
const dbClient = prisma as unknown as DbClient;
// Shared outbound-message recorder: tracks delivery state + emits the founder
// `message.sent` feed card for business-initiated WhatsApp sends.
const recordOutboundMessage = createRecordOutboundMessage(prisma);
const { nudgeDelayMs, abandonDelayMs } = getFollowUpTimerConfig();
const scheduleFollowUpJob = createScheduleFollowUpJob(dbClient, nudgeDelayMs);
const upsertApplication = createUpsertApplication(dbClient, { scheduleFollowUpJob });
const findLatestApplicationByPhone = createFindLatestApplicationByPhone(dbClient);

// Simple in-memory IP rate limiter: max N posts per window. Resets on restart;
// production hardening (shared store, WAF, captcha) is a follow-up.
const APPLICATION_RATE_LIMIT = 30;
const APPLICATION_RATE_WINDOW_MS = 60_000;
const applicationHits = new Map<string, { count: number; resetAt: number }>();

function applicationRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = applicationHits.get(ip);
  if (!entry || now > entry.resetAt) {
    applicationHits.set(ip, { count: 1, resetAt: now + APPLICATION_RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > APPLICATION_RATE_LIMIT;
}

app.post("/v1/applications", async (req, res) => {
  const ip = req.ip ?? "unknown";
  if (applicationRateLimited(ip)) {
    res.status(429).json({ result: "error" });
    return;
  }

  const parsed = applicationPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    // Lenient: log server-side, don't leak schema details. Still 200 so partial
    // autosaves stay silent for the user.
    logger.warn("application intake: invalid payload", {
      sessionId: (req.body as { sessionId?: unknown })?.sessionId,
      issues: parsed.error.issues.length
    });
    res.json({ result: "ok" });
    return;
  }

  try {
    const normalized = normalizeApplication(parsed.data);
    await upsertApplication(normalized);
    res.json({ result: "ok" });
  } catch (err) {
    logger.error("application intake: upsert failed", {
      sessionId: parsed.data.sessionId,
      error: err instanceof Error ? err.message : String(err)
    });
    res.status(500).json({ result: "error" });
  }
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
    // Payments only ever cure an account, so resync QCobro immediately rather
    // than waiting for the cron's deterioration pass. Best-effort: never throws.
    // A full-base pass (not just this customer) — see createSyncAllPortfolios.ts
    // for why a single-customer push isn't safe against the real API.
    const syncAllPortfoliosOnPayment = createSyncAllPortfolios(dbClient);
    const createPayment = createCreatePayment(dbClient, {
      onPaymentCreated: () => {
        void syncAllPortfoliosOnPayment();
      }
    });
    const generateReceipt = createGenerateReceipt({ db: dbClient });
    const listLoansByCollector = createListLoansByCollector(dbClient);
    const listLoansByCustomer = createListLoansByCustomer(dbClient);
    const listPaymentsByLoanId = createListPaymentsByLoanId(dbClient);
    const getLoanByLoanId = createGetLoanByLoanId(dbClient);
    const previewLateFee = createPreviewLateFee(dbClient);
    const getCustomer = createGetCustomer(dbClient);
    const getApplication = createGetApplication(dbClient);
    const approveApplication = createApproveApplication(dbClient);
    const rejectApplication = createRejectApplication(dbClient);
    const deleteApplication = createDeleteApplication(dbClient);
    const createLoan = createCreateLoan(dbClient);
    const calculateLoan = createCalculateLoan();
    const updateLoanStatus = createUpdateLoanStatus(dbClient);
    const listUsers = createListUsers(dbClient);
    const exportCollectorCustomers = createExportCollectorCustomers(dbClient);
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
      uploadMedia: whatsAppClient.uploadMedia.bind(whatsAppClient),
      recordOutbound: recordOutboundMessage
    });

    // Resolve the agent serving a profile, treating a disabled agent
    // (enabled: false in agents.yaml) as unserved.
    const getAgentForProfile = (profile: Profile) => {
      const agent = getAgentByProfile(agents, profile);
      return agent?.enabled ? agent : undefined;
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
      getAgentForProfile,
      findApplicationByPhone: createGetApplicationByPhone(prisma as unknown as DbClient)
    });

    const toExportedCustomer = (customer: {
      name: string;
      nickname?: string | null;
      phone: string;
      collectionPoint?: string | null;
      notes?: string | null;
      preferredPaymentDay?: string | null;
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
      listUsers: async (params?: { role?: "ADMIN" | "COLLECTOR" | "REVIEWER" }) => {
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
      getApplication: async (params: Parameters<ToolExecutorDependencies["getApplication"]>[0]) => {
        return getApplication(params);
      },
      // Founder copilot application-review write tools. Executed only through the
      // pending-action confirm flow (createConfirmCopilotAction), which passes the
      // confirming founder's id as context.userId -> reviewerId here.
      approveApplication: async (input, reviewerId) => approveApplication(input, reviewerId),
      rejectApplication: async (input, reviewerId) => rejectApplication(input, reviewerId),
      deleteApplication: async (input, reviewerId) => deleteApplication(input, reviewerId),
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
      // Founder copilot: send the promo template to a phone, no application
      // created. Same normalization + template lookup as the `sendPromo` tRPC
      // procedure (trpc/routers/protected.ts), reusing the shared WhatsApp client.
      sendPromo: async (params: Parameters<ToolExecutorDependencies["sendPromo"]>[0]) => {
        const { templateName, languageCode, imageUrl } = getWhatsAppPromoTemplate();
        const sendFn = createSendApplicationPromo({
          sendTemplateMessage: whatsAppClient.sendTemplateMessage.bind(whatsAppClient),
          templateName,
          languageCode,
          imageUrl,
          recordOutbound: recordOutboundMessage
        });
        const digits = params.phone.replace(/\D/g, "");
        const e164 =
          digits.length === 10
            ? `+1${digits}`
            : digits.length === 11 && digits.startsWith("1")
              ? `+${digits}`
              : null;
        return sendFn({ phone: e164, flowToken: randomUUID() });
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
      },
      // José intake tools
      joseGetApplicationState: createGetApplicationState(prisma as unknown as DbClient),
      joseSaveAnswer: createSaveAnswer(prisma as unknown as DbClient, upsertApplication),
      joseFinalizeApplication: createFinalizeApplication(
        prisma as unknown as DbClient,
        upsertApplication
      )
    });

    // Wire the founder copilot: it reuses the same tool executor as the WhatsApp
    // path and a text-model factory (injectable, kept out of the static router).
    // fileFeedback reuses the same githubFeedback config/Octokit path as the
    // human-facing feedback flow (protected.ts submitFeedback) — one GitHub
    // client, not two. Left unset (tool reports "not configured") if the
    // token is absent, same precondition-error convention as submitFeedback.
    const githubFeedbackOctokit = cfg.githubFeedback.token
      ? new Octokit({
          auth: cfg.githubFeedback.token,
          request: { headers: { "x-github-api-version": "2022-11-28" } }
        })
      : undefined;
    setCopilotDeps({
      toolExecutor,
      createModel: () => createChatModel(getLLMConfig("text"), { temperature: 0.3 }),
      fileFeedback: githubFeedbackOctokit
        ? (input) =>
            fileGithubIssue(
              { octokit: githubFeedbackOctokit, repo: cfg.githubFeedback.repo },
              input
            )
        : undefined
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

    // Persist a prospect intake Flow submission: same normalize+upsert path as the
    // website form, plus WhatsApp-only phone correlation (folds a completed Flow
    // into an existing application for the sender's phone). Website POST is unaffected.
    const submitApplicationFromFlow = createSubmitApplicationFromFlow({
      upsertApplication,
      findLatestApplicationByPhone
    });

    const processorConfig = {
      routeMessage,
      invokeLLM,
      sendWhatsAppMessage,
      sendTemplateMessage: whatsAppClient.sendTemplateMessage.bind(whatsAppClient),
      downloadMedia: whatsAppClient.downloadMedia.bind(whatsAppClient),
      getChatHistoryForUser,
      addMessageForUser,
      getAgentForProfile,
      submitApplicationFromFlow,
      // Apply async delivery receipts (sent/delivered/read/failed) to the tracked
      // outbound message so the founder feed card reflects real delivery state.
      updateOutboundStatus: createUpdateOutboundStatus(prisma),
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

// Follow-up worker — started once Prisma is ready (before initializeMessageProcessor)
const followUpTemplate = getWhatsAppFollowUpTemplate();
let stopFollowUpWorker: (() => void) | undefined;
let stopQCobroWorker: (() => void) | undefined;
let stopWatchRuleEvaluator: (() => void) | undefined;
let stopTaskWorker: (() => void) | undefined;

process.on("SIGTERM", () => {
  stopFollowUpWorker?.();
  stopQCobroWorker?.();
  stopWatchRuleEvaluator?.();
  stopTaskWorker?.();
  process.exit(0);
});
process.on("SIGINT", () => {
  stopFollowUpWorker?.();
  stopQCobroWorker?.();
  stopWatchRuleEvaluator?.();
  stopTaskWorker?.();
  process.exit(0);
});

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

      // Start follow-up timer worker
      const whatsAppClient2 = createWhatsAppClient();
      const sendFollowUpNudge = createSendFollowUpNudge({
        sendTemplateMessage: whatsAppClient2.sendTemplateMessage.bind(whatsAppClient2),
        templateName: followUpTemplate.templateName,
        languageCode: followUpTemplate.languageCode,
        recordOutbound: recordOutboundMessage
      });
      stopFollowUpWorker = createFollowUpWorker({
        client: dbClient,
        sendFollowUpNudge,
        abandonDelayMs
      });

      // Start QCobro cron worker (recompute + sync deterioration on qcobro.schedule)
      stopQCobroWorker = createQCobroWorker(dbClient);

      // Start the watch-rule evaluator (founder copilot alerts on state change)
      stopWatchRuleEvaluator = createWatchRuleEvaluator(
        prisma as unknown as Parameters<typeof createWatchRuleEvaluator>[0]
      );

      // Start the founder-task worker (fires scheduled automations)
      stopTaskWorker = createTaskWorker(
        prisma as unknown as Parameters<typeof createTaskWorker>[0]
      );
    });
  })
  .catch((error) => {
    logger.error("failed to start server", {
      error: (error as Error).message,
      stack: (error as Error).stack
    });
    process.exit(1);
  });
