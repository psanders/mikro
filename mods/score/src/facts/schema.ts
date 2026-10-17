/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The facts the Mikro Decisión extension pushes to Mikro after a bureau lookup.
 * Shared by the extension (validates before sending) and the apiserver (validates
 * on ingest). Only extracted facts travel: never the raw report, never the photo.
 */
import { z } from "zod";

export const CEDULA_PATTERN = /^\d{3}-\d{7}-\d$/;

/** "40212345678" / "402-1234567-8" → "402-1234567-8"; anything else → null. */
export function normalizeCedula(raw: string | null | undefined): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length !== 11) return null;
  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`;
}

const cedula = z.string().regex(CEDULA_PATTERN, "cédula ###-#######-#");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "yyyy-mm-dd");
const isoMonthOrDate = z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, "yyyy-mm or yyyy-mm-dd");
const money = z.number().finite();
const count = z.number().int().nonnegative();

/* ───────────────────────── Equifax (DataCrédito) ───────────────────────── */

export const equifaxAccountSchema = z.object({
  ref: z.number().int(),
  sector: z.string(),
  product: z.string().optional(),
  currency: z.string().optional(),
  status: z.enum(["NORMAL", "MORA", "LEGAL", "CASTIGADO", "CANCELADA"]),
  /** Payment-status grid, most recent month first (legend: - 0 . 1 2 S L I C). */
  pdv: z.string().regex(/^[-0.12SLIC]*$/),
  /** Utilization bucket grid 0–6, most recent month first. */
  util: z.string().regex(/^[-0-6]*$/),
  approved: money.optional(),
  owed: money.optional(),
  installment: money.optional(),
  overdue: money.optional(),
  opened: isoMonthOrDate.nullable().optional()
});

export const identitySchema = z.object({
  fullName: z.string().min(1),
  birthDate: isoDate.optional(),
  gender: z.enum(["M", "F"]).optional()
});

export const equifaxFactsSchema = z.object({
  identity: identitySchema.nullable(),
  /** Equifax's own score, when the report shows one. Range confirmed per real report. */
  bureauScore: z.object({ value: z.number(), label: z.string().optional() }).nullable(),
  reportDate: isoDate,
  inquiries: z.array(z.object({ date: isoDate, sector: z.string().optional() })),
  summary: z.object({ oldestCredit: isoMonthOrDate, newestCredit: isoMonthOrDate }),
  accounts: z.array(equifaxAccountSchema)
});

/* ───────────────────────── PrestamosCloud (Datapréstamos) ───────────────── */

export const PCLOUD_LOAN_STATUSES = [
  "AL_DIA",
  "ATRASADOS",
  "VENCIDOS",
  "TERMINADOS",
  "OTHER"
] as const;
export const PCLOUD_FINAL_CONDITIONS = [
  "A_TIEMPO",
  "ATRASADOS",
  "VENCIDOS",
  "PENDIENTES",
  "OTHER"
] as const;

export const pcloudLoanSchema = z.object({
  amount: money,
  status: z.enum(PCLOUD_LOAN_STATUSES),
  /** The portal's text when `status` is OTHER. */
  statusRaw: z.string().optional(),
  uncollectible: z.boolean(),
  finalCondition: z.enum(PCLOUD_FINAL_CONDITIONS).nullable(),
  daysLate: count.nullable(),
  startDate: isoDate.nullable(),
  rating: z.number().min(0).max(5).nullable(),
  principalOwed: money.nullable()
});

export const pcloudLenderSchema = z.object({
  name: z.string().min(1),
  loanCount: count,
  totalLent: money,
  totalOwed: money,
  loans: z.array(pcloudLoanSchema)
});

export const pcloudFactsSchema = z.object({
  identity: identitySchema.nullable(),
  kpis: z.object({
    /** 300–850; null when the portal shows "NO DATOS". */
    score: z.object({ value: z.number().int().min(300).max(850), label: z.string() }).nullable(),
    onTimePct: z.number().min(0).max(100).nullable(),
    completionPct: z.number().min(0).max(100).nullable(),
    riskFactors: z.object({ count, max: count, label: z.string() }).nullable(),
    isDelinquent: z.boolean(),
    activeLoans: count,
    closedLoans: count,
    lenderCount: count,
    totalLent: money,
    totalOwed: money,
    coSignerTotal: money
  }),
  lenders: z.array(pcloudLenderSchema),
  inquiries: z.array(z.object({ type: z.string(), date: z.string(), lender: z.string() })),
  comments: z.array(
    z.object({ lender: z.string(), recommends: z.boolean(), date: z.string(), text: z.string() })
  )
});

/* ───────────────────────── Envelope ───────────────────────── */

const envelope = {
  cedula,
  capturedAt: z.string().datetime(),
  /** Origin only, e.g. https://portal.prestamoscloud.com — never a URL with a query. */
  portalOrigin: z.string().url(),
  adapterVersion: z.string().min(1),
  /** SHA-256 (hex) of the raw responses the facts came from. The raw data is not sent. */
  rawSha256: z.string().regex(/^[a-f0-9]{64}$/),
  applicationId: z.string().min(1).optional()
};

export const creditReportPushSchema = z.discriminatedUnion("source", [
  z.object({ ...envelope, source: z.literal("EQUIFAX"), facts: equifaxFactsSchema }),
  z.object({ ...envelope, source: z.literal("PRESTAMOSCLOUD"), facts: pcloudFactsSchema })
]);

export const CREDIT_REPORT_SCHEMA_VERSION = 1;

export type EquifaxFacts = z.infer<typeof equifaxFactsSchema>;
export type PcloudFacts = z.infer<typeof pcloudFactsSchema>;
export type PcloudLoan = z.infer<typeof pcloudLoanSchema>;
export type CreditReportPush = z.infer<typeof creditReportPushSchema>;
export type CreditReportSource = CreditReportPush["source"];
