/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Initiates collection calls via Fonoster SDK.
 */

import * as SDK from "@fonoster/sdk";
import { logger } from "../logger.js";

export interface InitiateCollectionCallParams {
  phone: string;
  loan: {
    loanId: number;
    principal: number;
    termLength: number;
    paymentAmount: number;
    paymentFrequency: string;
    missedPayments: number;
    memberName: string;
  };
}

function isFonosterEnabled(): boolean {
  return process.env.MIKRO_FONOSTER_ENABLED === "true";
}

const REQUIRED_FONOSTER_ENV_VARS = [
  "MIKRO_FONOSTER_WORKSPACE_ACCESS_KEY_ID",
  "MIKRO_FONOSTER_APIKEY_ACCESS_KEY_ID",
  "MIKRO_FONOSTER_APIKEY_ACCESS_KEY_SECRET",
  "MIKRO_FONOSTER_FROM_NUMBER",
  "MIKRO_FONOSTER_APP_REF"
] as const;

function validateFonosterEnv(): void {
  const missing = REQUIRED_FONOSTER_ENV_VARS.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Fonoster is enabled but required env vars are missing: ${missing.join(", ")}. ` +
        "Set them or set MIKRO_FONOSTER_ENABLED=false."
    );
  }
}

let fonosterClientPromise: Promise<SDK.Client> | null = null;

/**
 * Lazy singleton: create and authenticate the Fonoster SDK client once.
 * The SDK auto-refreshes tokens when they expire.
 */
async function getClient(): Promise<SDK.Client> {
  if (fonosterClientPromise === null) {
    validateFonosterEnv();
    const accessKeyId = process.env.MIKRO_FONOSTER_WORKSPACE_ACCESS_KEY_ID!;
    const apiKeyId = process.env.MIKRO_FONOSTER_APIKEY_ACCESS_KEY_ID!;
    const apiKeySecret = process.env.MIKRO_FONOSTER_APIKEY_ACCESS_KEY_SECRET!;
    const client = new SDK.Client({ accessKeyId });
    await client.loginWithApiKey(apiKeyId, apiKeySecret);
    fonosterClientPromise = Promise.resolve(client);
  }
  return fonosterClientPromise;
}

/**
 * Initiate an outbound collection call.
 * When MIKRO_FONOSTER_ENABLED=false, logs and returns a placeholder ref.
 * When enabled, uses @fonoster/sdk with WORKSPACE_ACCESS_KEY_ID (constructor) and
 * APIKEY_ACCESS_KEY_ID + APIKEY_ACCESS_KEY_SECRET (login).
 */
export async function initiateCollectionCall(
  params: InitiateCollectionCallParams
): Promise<{ ref: string }> {
  const { loan } = params;
  const metadata: Record<string, string> = {
    loanId: String(loan.loanId),
    principal: String(loan.principal),
    paymentAmount: String(loan.paymentAmount),
    paymentFrequency: loan.paymentFrequency,
    missedPayments: String(loan.missedPayments),
    memberName: loan.memberName
  };

  if (!isFonosterEnabled()) {
    logger.info("collection call placeholder (fonoster disabled)", {
      phone: params.phone,
      loanId: loan.loanId,
      missedPayments: loan.missedPayments,
      metadata
    });
    return { ref: `placeholder-${Date.now()}-${loan.loanId}` };
  }

  const from = process.env.MIKRO_FONOSTER_FROM_NUMBER!;
  const to = params.phone;
  const appRef = process.env.MIKRO_FONOSTER_APP_REF!;

  try {
    const client = await getClient();
    const calls = new SDK.Calls(client);
    const { ref, statusStream } = await calls.createCall({
      from,
      to,
      appRef,
      timeout: 30,
      metadata
    });
    // Consume statusStream in the background so the call lifecycle is tracked.
    // NOTE: The Fonoster SDK has a bug – it throws synchronously inside an
    // EventEmitter callback when the gRPC stream errors.  That throw becomes
    // an uncaught exception (not catchable by try/catch here).  A process-level
    // uncaughtException handler in index.ts absorbs it so the server stays up.
    // We still keep the try/catch below for errors that *do* propagate through
    // the async-iterator protocol, and we add a timeout so a hung stream
    // doesn't leak resources forever.
    const STREAM_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
    (async () => {
      const breakReasons = ["ANSWER", "NOANSWER", "BUSY", "FAILED", "CANCEL", "COMPLETED"];
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        // Race the stream against a timeout so we don't hold it open forever
        const timeout = new Promise<void>((resolve) => {
          timer = setTimeout(() => {
            logger.warn("fonoster statusStream timed out after 5 min, closing", { ref });
            resolve();
          }, STREAM_TIMEOUT_MS);
        });

        const consume = async () => {
          for await (const s of statusStream) {
            logger.debug("fonoster call status", { ref, status: s.status });
            if (breakReasons.includes(s.status)) {
              logger.debug("fonoster call reached terminal status", { ref, status: s.status });
              break;
            }
          }
        };

        await Promise.race([consume(), timeout]);
      } catch (e) {
        logger.warn("fonoster statusStream error", { ref, err: e });
      } finally {
        if (timer) clearTimeout(timer);
        // Explicitly close the async generator so the SDK's internal polling
        // loop (50 ms setTimeout) stops and the gRPC call reference can be GC'd.
        try {
          await statusStream.return?.(undefined as never);
        } catch {
          // ignore – generator may already be closed
        }
      }
    })();
    logger.info("collection call placed", { ref, phone: to, loanId: params.loan.loanId });
    return { ref };
  } catch (err) {
    logger.error("fonoster createCall failed", {
      phone: to,
      loanId: params.loan.loanId,
      metadata,
      err
    });
    throw err;
  }
}
