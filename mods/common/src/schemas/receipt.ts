/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";

/**
 * Schema for generating a receipt.
 */
export const generateReceiptSchema = z.object({
  paymentId: z.uuid({ error: "Invalid payment ID" })
});

/**
 * Input type for generating a receipt.
 */
export type GenerateReceiptInput = z.infer<typeof generateReceiptSchema>;

/**
 * Schema for receipt data (used in JWT payload and API response).
 */
export const receiptDataSchema = z.object({
  loanNumber: z.string(),
  name: z.string(),
  date: z.string(),
  amountPaid: z.string(),
  pendingPayments: z.number(),
  paymentNumber: z.string(),
  agentName: z.string().optional()
});

/**
 * Receipt data type.
 */
export type ReceiptDataInput = z.infer<typeof receiptDataSchema>;
