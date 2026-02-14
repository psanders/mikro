/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Placeholder for initiating collection calls via Fonoster.
 * Real implementation will use @fonoster/sdk; for now we log and return a mock ref.
 */

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

/**
 * Build the partialPrompt string from loan context for the Fonoster Autopilot app.
 */
export function buildCollectionCallPartialPrompt(params: InitiateCollectionCallParams): string {
  const { loan } = params;
  return [
    `Loan ID: ${loan.loanId}`,
    `Principal: ${loan.principal}`,
    `Payment Amount: ${loan.paymentAmount}`,
    `Payment Frequency: ${loan.paymentFrequency}`,
    `Missed Payments: ${loan.missedPayments}`,
    `Member Name: ${loan.memberName}`
  ].join(", ");
}

const FONOSTER_ENABLED = process.env.MIKRO_FONOSTER_ENABLED === "true";

/**
 * Initiate an outbound collection call. Placeholder: logs and returns mock ref when disabled.
 * When MIKRO_FONOSTER_ENABLED=true, the real SDK would be used with:
 * - MIKRO_FONOSTER_ACCESS_KEY_ID
 * - MIKRO_FONOSTER_API_KEY_ID
 * - MIKRO_FONOSTER_API_KEY_SECRET
 * - MIKRO_FONOSTER_FROM_NUMBER
 * - MIKRO_FONOSTER_APP_REF
 */
export async function initiateCollectionCall(
  params: InitiateCollectionCallParams
): Promise<{ ref: string }> {
  const partialPrompt = buildCollectionCallPartialPrompt(params);

  if (!FONOSTER_ENABLED) {
    logger.info("collection call placeholder (fonoster disabled)", {
      phone: params.phone,
      loanId: params.loan.loanId,
      missedPayments: params.loan.missedPayments,
      partialPrompt
    });
    return { ref: `placeholder-${Date.now()}-${params.loan.loanId}` };
  }

  // TODO: Real implementation using @fonoster/sdk
  // const client = new SDK.Client({ accessKeyId: process.env.MIKRO_FONOSTER_ACCESS_KEY_ID });
  // await client.loginWithApiKey(process.env.MIKRO_FONOSTER_API_KEY_ID, process.env.MIKRO_FONOSTER_API_KEY_SECRET);
  // const calls = new SDK.Calls(client);
  // const { ref } = await calls.createCall({
  //   from: process.env.MIKRO_FONOSTER_FROM_NUMBER,
  //   to: params.phone,
  //   appRef: process.env.MIKRO_FONOSTER_APP_REF,
  //   timeout: 30,
  //   metadata: { partialPrompt },
  // });
  logger.info("collection call would be placed (sdk not wired)", {
    phone: params.phone,
    loanId: params.loan.loanId,
    partialPrompt
  });
  return { ref: `placeholder-${Date.now()}-${params.loan.loanId}` };
}
