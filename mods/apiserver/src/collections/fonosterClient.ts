/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Initiates collection calls via Fonoster SDK.
 */

import { getConfig } from "@mikro/common";
import * as SDK from "@fonoster/sdk";
import { logger } from "../logger.js";

export interface InitiateCollectionCallParams {
  phone: string;
  appRef?: string;
  loan: {
    loanId: number;
    principal: number;
    termLength: number;
    paymentAmount: number;
    paymentFrequency: string;
    missedPayments: number;
    customerName: string;
  };
}

/**
 * Create and authenticate a fresh Fonoster SDK client.
 * A new login is performed on every call so tokens are always fresh and
 * we never hit "16 UNAUTHENTICATED: Invalid or expired token" from a
 * stale cached session.
 */
async function getClient(): Promise<SDK.Client> {
  const { fonoster } = getConfig();
  const client = new SDK.Client({ accessKeyId: fonoster.workspaceAccessKeyId });
  await client.loginWithApiKey(fonoster.apikeyAccessKeyId, fonoster.apikeyAccessKeySecret);
  return client;
}

/**
 * Initiate an outbound collection call.
 * When fonoster.enabled is false, logs and returns a placeholder ref.
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
    customerName: loan.customerName
  };

  const { fonoster } = getConfig();
  if (!fonoster.enabled) {
    logger.info("collection call placeholder (fonoster disabled)", {
      phone: params.phone,
      loanId: loan.loanId,
      missedPayments: loan.missedPayments,
      metadata
    });
    return { ref: `placeholder-${Date.now()}-${loan.loanId}` };
  }

  const from = fonoster.fromNumber;
  const to = params.phone;
  const appRef = params.appRef ?? fonoster.appRef;

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
    // NOTE: The Fonoster SDK has a bug -- it throws synchronously inside an
    // EventEmitter callback when the gRPC stream errors.  That throw becomes
    // an uncaught exception (not catchable by try/catch here).  A process-level
    // uncaughtException handler in index.ts absorbs it so the server stays up.
    const STREAM_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
    (async () => {
      const breakReasons = ["ANSWER", "NOANSWER", "BUSY", "FAILED", "CANCEL", "COMPLETED"];
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
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
        try {
          await statusStream.return?.(undefined as never);
        } catch {
          // ignore -- generator may already be closed
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
