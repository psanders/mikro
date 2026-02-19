/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Event-driven: send a WhatsApp template when a payment is created.
 * Not called by the daily cron.
 */

import { getPaymentConfirmationTemplateName, getWhatsAppLanguageCode } from "./collectionConfig.js";
import { logger } from "../logger.js";
import {
  executeCollectionAction,
  isDryRun,
  logDryRun,
  Channel,
  AttemptType,
  type CollectionDeps,
  type CollectionTarget
} from "./collectionAttemptHelper.js";

export type SendPaymentConfirmationDeps = CollectionDeps;

/**
 * Sends a payment confirmation template to the customer and records a CollectionAttempt.
 * Call this asynchronously after creating a payment (fire-and-forget).
 */
export async function sendPaymentConfirmation(
  paymentId: string,
  deps: SendPaymentConfirmationDeps
): Promise<void> {
  const templateName = getPaymentConfirmationTemplateName();
  if (!templateName) {
    logger.verbose("payment confirmation skipped (no template configured)");
    return;
  }

  const payment = await deps.db.payment.findUnique({
    where: { id: paymentId },
    include: {
      loan: { include: { customer: true } }
    }
  });

  if (!payment || !payment.loan?.customer) {
    logger.warn("payment or loan/customer not found for confirmation", { paymentId });
    return;
  }

  const customer = payment.loan.customer as { id: string; phone: string; name: string };
  const loan = payment.loan as { id: string; loanId: number };
  const amount = String(payment.amount);
  const paymentNumber = `Préstamo #${loan.loanId} - ${amount}`;
  const target: CollectionTarget = { customer, loan };
  const bodyParameters = [paymentNumber];

  if (isDryRun()) {
    logDryRun({
      channel: "WHATSAPP",
      type: "PAYMENT_CONFIRMATION",
      target,
      templateName,
      bodyParameters
    });
    return;
  }

  await executeCollectionAction(
    async () => {
      const res = await deps.sendWhatsAppTemplate({
        phone: customer.phone,
        templateName,
        languageCode: getWhatsAppLanguageCode(),
        bodyParameters
      });
      return res.messages?.[0]?.id ?? null;
    },
    deps.db,
    { target, channel: Channel.WHATSAPP, type: AttemptType.PAYMENT_CONFIRMATION, templateName }
  );
}
