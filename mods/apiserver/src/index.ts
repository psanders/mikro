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
import { handleWhatsAppMessage, getWebhookVerifyToken } from "@mikro/agents";

// Re-export AppRouter type for clients
export type { AppRouter } from "./trpc/index.js";

const app = express();
const PORT = process.env.PORT || 3000;

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
    console.log("[WhatsApp] Webhook verified successfully");
    res.status(200).send(challenge);
  } else {
    console.warn("[WhatsApp] Webhook verification failed", { mode, token });
    res.sendStatus(403);
  }
});

// WhatsApp webhook messages (POST)
app.post("/webhook", async (req, res) => {
  try {
    const result = await handleWhatsAppMessage(req.body);
    console.log(
      `[WhatsApp] Processed ${result.messagesProcessed} messages from ${result.senders.length} senders`
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error("[WhatsApp] Invalid webhook payload:", error.message);
    } else {
      const err = error as Error;
      console.error("[WhatsApp] Error processing webhook:", err.message);
    }
  }

  // Always return 200 to WhatsApp
  res.status(200).send("OK");
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
