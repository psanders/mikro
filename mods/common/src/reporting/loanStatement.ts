/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The loan-statement report: a customer-facing 2-page PDF (+ canonical JSON)
 * built ONLY from the eval framework's canonical snapshot + the reporting
 * foundation's schedule/allocation helpers — never a hand-derived schedule
 * (the #10036 dispute script violated that rule; this is the fix).
 *
 * Input is DB-free and snapshot-shaped (loan terms + customer + payments +
 * policy — the same shape `buildLoanSnapshot` takes). The apiserver resolves
 * the DB and maps rows into this shape; `buildData` here runs
 * `buildLoanSnapshot` → `buildRepaymentSchedule` → `evaluateSnapshot` and
 * assembles the full typed statement model (JSON = canonical). `toDocument`
 * is presentation-only: it composes the shared layout blocks into the
 * 2-page layout matching the issue #161 look/feel.
 */
import { z } from "zod/v4";
import { buildLoanSnapshot, type BuildSnapshotInput, type LoanSnapshot } from "../eval/snapshot.js";
import { evaluateSnapshot, type EvalReport } from "../eval/runChecks.js";
import { formatMoney } from "../utils/formatMoney.js";
import { paymentKindEnum, paymentStatusEnum, type PaymentKind } from "../schemas/payment.js";
import { loanStatusEnum } from "../schemas/loan.js";
import { buildRepaymentSchedule, type RepaymentScheduleRow } from "./schedule.js";
import { defineReport, type Report } from "./report.js";
import {
  brandHeader,
  verificationBanner,
  kpiGrid,
  dataTable,
  section,
  footerNote,
  page,
  type KpiCell,
  type TableRow
} from "./blocks.js";
import type { ReportDocument } from "./renderer.js";

// ==================== Input schema (DB-free, snapshot-shaped) ====================

const snapshotPaymentInputSchema = z.object({
  id: z.string(),
  kind: paymentKindEnum,
  status: paymentStatusEnum,
  amount: z.number(),
  paidAt: z.coerce.date(),
  method: z.string().nullish(),
  collectedById: z.string().nullish(),
  collectedByName: z.string().nullish(),
  linkedPaymentId: z.string().nullish(),
  notes: z.string().nullish()
});

const moraPolicyInputSchema = z.object({
  moraRate: z.number(),
  moraGraceDays: z.number(),
  moraCapInCuotas: z.number(),
  moraMinDop: z.number(),
  moraStopOnDefault: z.boolean(),
  moraEffectiveFrom: z.string().nullable()
});

/**
 * Mirrors `BuildSnapshotInput` exactly (loan terms + customer + payments +
 * policy). Validated before `buildLoanSnapshot` ever runs — an unknown/invalid
 * loan id never reaches this schema; the apiserver builder maps "loan not
 * found" into its own error before calling the report.
 */
export const loanStatementInputSchema = z.object({
  loanId: z.number().int().positive("Loan ID must be a positive integer"),
  customer: z.object({
    id: z.string(),
    name: z.string(),
    nickname: z.string().nullish(),
    preferredPaymentDay: z.string().nullable()
  }),
  loan: z.object({
    principal: z.number().nonnegative(),
    paymentAmount: z.number().positive(),
    termLength: z.number().int().positive(),
    paymentFrequency: z.string(),
    status: loanStatusEnum,
    createdAt: z.coerce.date(),
    startingDate: z.coerce.date().nullable(),
    updatedAt: z.coerce.date(),
    nickname: z.string().nullable()
  }),
  payments: z.array(snapshotPaymentInputSchema),
  policy: moraPolicyInputSchema,
  asOf: z.coerce.date().optional()
});

export type LoanStatementInput = z.infer<typeof loanStatementInputSchema>;

// ==================== Canonical data model ====================

export interface LoanStatementKpis {
  principal: number;
  interest: number;
  totalPayable: number;
  cuota: number;
  paidToDate: number;
  cuotasCovered: number;
  remainingBalance: number;
  moraAccrued: number;
  grossMora: number;
  collectedMora: number;
  daysOverdue: number;
  /** ISO date the customer first fell behind, or null when current. */
  sinceDate: string | null;
  missedCycles: number;
}

export interface LoanStatementReceivedPayment {
  id: string;
  paidAt: string;
  kind: PaymentKind;
  amount: number;
  method: string | null;
}

/** The full typed loan-statement data model — canonical; the PDF adds no new data. */
export interface LoanStatementData {
  loanId: number;
  generatedAt: string;
  customerName: string;
  disbursementDate: string | null;
  paymentFrequency: string;
  termLength: number;
  snapshot: LoanSnapshot;
  evalReport: EvalReport;
  schedule: RepaymentScheduleRow[];
  kpis: LoanStatementKpis;
  /** Received (non-reversed) payments, page-2 ledger. Reversed rows are excluded here. */
  receivedPayments: LoanStatementReceivedPayment[];
  reversedCount: number;
  reversedTotal: number;
}

const MS_PER_DAY = 86_400_000;

/** Build the canonical loan-statement data model from a validated snapshot input. */
export function buildLoanStatementData(input: LoanStatementInput): LoanStatementData {
  const snapshot = buildLoanSnapshot(input as BuildSnapshotInput);
  const schedule = buildRepaymentSchedule(snapshot);
  const evalReport = evaluateSnapshot(snapshot);

  const { terms, derived } = snapshot;
  const totalPayable = terms.termLength * terms.cuota;
  const sinceDate =
    derived.daysOverdue > 0
      ? new Date(new Date(snapshot.asOf).getTime() - derived.daysOverdue * MS_PER_DAY).toISOString()
      : null;

  const receivedPayments: LoanStatementReceivedPayment[] = snapshot.ledger
    .filter((l) => l.status !== "REVERSED")
    .map((l) => ({
      id: l.id,
      paidAt: l.paidAt,
      kind: l.kind,
      amount: l.amount,
      method: l.method ?? null
    }));

  const reversedRows = snapshot.ledger.filter((l) => l.status === "REVERSED");

  return {
    loanId: snapshot.loanId,
    generatedAt: new Date().toISOString(),
    customerName: snapshot.customer.nickname ?? snapshot.customer.name,
    disbursementDate: terms.startingDate ?? terms.createdAt,
    paymentFrequency: terms.paymentFrequency,
    termLength: terms.termLength,
    snapshot,
    evalReport,
    schedule,
    kpis: {
      principal: terms.principal,
      interest: Math.max(0, totalPayable - terms.principal),
      totalPayable,
      cuota: terms.cuota,
      paidToDate: derived.totalInstallmentPaid,
      cuotasCovered: derived.cuotasCovered,
      remainingBalance: derived.remainingBalance,
      moraAccrued: derived.moraAccrued,
      grossMora: derived.grossMora,
      collectedMora: derived.collectedMora,
      daysOverdue: derived.daysOverdue,
      sinceDate,
      missedCycles: derived.missedCycles
    },
    receivedPayments,
    reversedCount: reversedRows.length,
    reversedTotal: reversedRows.reduce((sum, r) => sum + r.amount, 0)
  };
}

// ==================== Presentation (page composition) ====================

const FREQ_LABELS: Record<string, string> = {
  DAILY: "Diario",
  WEEKLY: "Semanal",
  BIWEEKLY: "Quincenal",
  MONTHLY: "Mensual"
};

const PAYMENT_KIND_LABELS: Record<string, string> = {
  INSTALLMENT: "Cuota",
  LATE_FEE: "Mora"
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia"
};

function formatDop(n: number): string {
  return `RD$${formatMoney(n)}`;
}

function formatDateEs(d: string | Date): string {
  // Date-only business values are stored at UTC midnight; format on the UTC
  // calendar day so a negative-offset runtime timezone doesn't shift them a
  // day earlier (e.g. a 13 may disbursement rendering as 12 may).
  return new Date(d).toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });
}

function isSameUtcDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getUTCFullYear() === db.getUTCFullYear() &&
    da.getUTCMonth() === db.getUTCMonth() &&
    da.getUTCDate() === db.getUTCDate()
  );
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** ESTADO pill label + tone for one schedule row (text-only, per design). */
function estadoFor(
  row: RepaymentScheduleRow,
  asOf: string
): { label: string; tone: "paid" | "partial" | "overdue" | "upcoming" | "dueToday" } {
  if (row.status === "PAID") return { label: "Pagada", tone: "paid" };
  if (row.status === "PARTIAL") return { label: "Parcial", tone: "partial" };
  if (row.status === "UPCOMING") return { label: "Pendiente", tone: "upcoming" };
  // OVERDUE: distinguish "due today" from genuinely overdue.
  if (isSameUtcDay(row.dueDate, asOf)) return { label: "Vence hoy", tone: "dueToday" };
  return { label: "Sin pago", tone: "overdue" };
}

/** CUBIERTA EL cell: coverage date + delta, "— falta RD$X" for partials, or "—". */
function cubiertaElFor(row: RepaymentScheduleRow, cuota: number): string {
  if (row.status === "PAID" && row.coverageDate) {
    const deltaDays = Math.round(
      (new Date(row.coverageDate).getTime() - new Date(row.dueDate).getTime()) / MS_PER_DAY
    );
    const dateStr = formatDateEs(row.coverageDate);
    if (deltaDays === 0) return `${dateStr} (a tiempo)`;
    if (deltaDays > 0) return `${dateStr} (+${deltaDays} días)`;
    return `${dateStr} (−${Math.abs(deltaDays)} días)`;
  }
  if (row.status === "PARTIAL") {
    const missing = round2(cuota - row.amountApplied);
    return `— falta ${formatDop(missing)}`;
  }
  return "—";
}

function buildKpiCells(data: LoanStatementData): KpiCell[] {
  const { kpis } = data;
  return [
    { label: "Capital prestado", value: formatDop(kpis.principal) },
    { label: "Interés del plazo", value: formatDop(kpis.interest) },
    {
      label: "Total a pagar",
      value: formatDop(kpis.totalPayable),
      subtext: `${data.termLength} × ${formatDop(kpis.cuota)}`
    },
    {
      label: "Abonado a la fecha",
      value: formatDop(kpis.paidToDate),
      subtext: `${kpis.cuotasCovered} de ${data.termLength} cuotas cubiertas`
    },
    { label: "Saldo pendiente", value: formatDop(kpis.remainingBalance), emphasize: true },
    {
      label: "Mora acumulada",
      value: formatDop(kpis.moraAccrued),
      subtext: `${formatDop(kpis.grossMora)} bruto − ${formatDop(kpis.collectedMora)} cobrado`,
      emphasize: true
    },
    {
      label: "Días de atraso",
      value: `${kpis.daysOverdue} días`,
      subtext: kpis.sinceDate ? `desde ${formatDateEs(kpis.sinceDate)}` : "Al día",
      emphasize: true
    },
    { label: "Ciclos atrasados", value: `${kpis.missedCycles}` }
  ];
}

function buildVerificationBanner(data: LoanStatementData) {
  const { evalReport } = data;
  const total = evalReport.results.length;
  const headline = `Verificación del sistema: ${evalReport.passCount}/${total} controles superados.`;

  if (evalReport.criticalFailures.length === 0) {
    return verificationBanner({
      headline,
      explanation:
        "El saldo, las cuotas cubiertas y la mora se recalculan de forma independiente contra el historial de pagos y coinciden.",
      tone: "pass"
    });
  }

  const failing =
    evalReport.results.find(
      (r) => !r.pass && r.severity === "critical" && evalReport.criticalFailures.includes(r.id)
    ) ?? evalReport.results.find((r) => !r.pass);

  return verificationBanner({
    headline,
    explanation: failing
      ? `No se puede confirmar que el ledger esté completamente conciliado: "${failing.title}" — ${failing.explanation}`
      : "No se puede confirmar que el ledger esté completamente conciliado.",
    tone: "fail"
  });
}

function buildScheduleRows(data: LoanStatementData): TableRow[] {
  return data.schedule.map((row) => {
    const estado = estadoFor(row, data.snapshot.asOf);
    return {
      cells: {
        cuota: `${row.cuota}`,
        due: formatDateEs(row.dueDate),
        estado: "",
        cubierta: cubiertaElFor(row, data.kpis.cuota),
        monto: formatDop(data.kpis.cuota),
        aplicado: formatDop(row.amountApplied)
      },
      status: { column: "estado", value: estado.label, tone: estado.tone }
    };
  });
}

function buildReceivedPaymentsRows(data: LoanStatementData): TableRow[] {
  return data.receivedPayments.map((p) => ({
    cells: {
      fecha: formatDateEs(p.paidAt),
      tipo: PAYMENT_KIND_LABELS[p.kind] ?? p.kind,
      monto: formatDop(p.amount),
      metodo: p.method ? (PAYMENT_METHOD_LABELS[p.method] ?? p.method) : "—"
    }
  }));
}

function buildReconciliationNote(data: LoanStatementData): string[] {
  const receivedTotal = data.receivedPayments.reduce((sum, p) => sum + p.amount, 0);
  const lines: string[] = [];
  if (data.reversedCount > 0) {
    lines.push(
      `Se excluyeron ${data.reversedCount} pago(s) revertido(s) por ${formatDop(data.reversedTotal)}: el dinero no se perdió ni se contó dos veces, simplemente fue anulado.`
    );
  } else {
    lines.push(
      "No hay pagos revertidos en este préstamo; el historial incluye todo el dinero recibido."
    );
  }
  lines.push(
    `Total recibido (no revertido): ${formatDop(receivedTotal)} en ${data.receivedPayments.length} pago(s).`
  );
  return lines;
}

/** Compose the 2-page loan-statement document from the canonical data model. */
export function buildLoanStatementDocument(data: LoanStatementData): ReportDocument {
  const freqLabel = FREQ_LABELS[data.paymentFrequency] ?? data.paymentFrequency;
  const meta = [
    `Generado ${formatDateEs(data.generatedAt)}`,
    data.disbursementDate ? `Desembolso ${formatDateEs(data.disbursementDate)}` : "Desembolso —",
    `Frecuencia ${freqLabel} · ${data.termLength} cuotas`
  ];

  const p1 = page([
    brandHeader({
      title: `Préstamo #${data.loanId}`,
      subtitle: `ESTADO DE CUENTA — ${data.customerName}`,
      meta
    }),
    buildVerificationBanner(data),
    kpiGrid({ cells: buildKpiCells(data), columns: 4 }),
    section("Cronograma de pagos", [
      dataTable({
        columns: [
          { key: "cuota", header: "Cuota", weight: 0.6 },
          { key: "due", header: "Vence", weight: 1.1 },
          { key: "estado", header: "Estado", weight: 1 },
          { key: "cubierta", header: "Cubierta el", weight: 1.6 },
          { key: "monto", header: "Monto cuota", weight: 1.1, align: "right" },
          { key: "aplicado", header: "Aplicado", weight: 1.1, align: "right" }
        ],
        rows: buildScheduleRows(data)
      })
    ])
  ]);

  const p2 = page([
    section("Historial de pagos recibidos", [
      dataTable({
        columns: [
          { key: "fecha", header: "Fecha", weight: 1 },
          { key: "tipo", header: "Tipo", weight: 1 },
          { key: "monto", header: "Monto", weight: 1, align: "right" },
          { key: "metodo", header: "Método", weight: 1 }
        ],
        rows: buildReceivedPaymentsRows(data)
      })
    ]),
    footerNote([
      ...buildReconciliationNote(data),
      `Préstamo #${data.loanId} · Generado ${formatDateEs(data.generatedAt)} · Documento generado automáticamente por Mikro.`
    ])
  ]);

  return { pages: [{ layout: p1 }, { layout: p2 }] };
}

/** The loan-statement report: validated `{ ...BuildSnapshotInput }` in, JSON/PDF out. */
export const loanStatementReport: Report<LoanStatementData> = defineReport({
  name: "loan-statement",
  inputSchema: loanStatementInputSchema,
  buildData: buildLoanStatementData,
  toDocument: buildLoanStatementDocument
});
