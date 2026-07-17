/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The loan-statement report: a customer-facing multi-page PDF (+ canonical
 * JSON) built ONLY from the eval framework's canonical snapshot + the
 * reporting foundation's schedule/allocation helpers — never a hand-derived
 * schedule (the #10036 dispute script violated that rule; this is the fix).
 *
 * Input is DB-free and snapshot-shaped (loan terms + customer + payments +
 * policy — the same shape `buildLoanSnapshot` takes). The apiserver resolves
 * the DB and maps rows into this shape; `buildData` here runs
 * `buildLoanSnapshot` → `buildRepaymentSchedule` → `evaluateSnapshot` and
 * assembles the full typed statement model (JSON = canonical). `toDocument`
 * is presentation-only: it composes the shared layout blocks into the
 * Pencil "Estado de Cuenta" layout.
 */
import { z } from "zod/v4";
import { buildLoanSnapshot, type BuildSnapshotInput, type LoanSnapshot } from "../eval/snapshot.js";
import { evaluateSnapshot, type EvalReport } from "../eval/runChecks.js";
import { paymentKindEnum, paymentStatusEnum, type PaymentKind } from "../schemas/payment.js";
import { loanStatusEnum } from "../schemas/loan.js";
import { buildRepaymentSchedule, type RepaymentScheduleRow } from "./schedule.js";
import { defineReport, type Report } from "./report.js";
import { composeReportPages } from "./compose.js";
import {
  brandHeader,
  verificationBanner,
  noteCard,
  kpiGrid,
  dataTable,
  section,
  paginateRows,
  type KpiCell,
  type TableRow,
  type TableColumn,
  type ReportElement,
  type BrandHeaderMeta
} from "./blocks.js";
import { headerHeight, verificationBannerHeight, kpiGridHeight, tableRowBudget } from "./layout.js";
import type { ReportDocument } from "./renderer.js";
import { formatDop, formatDateEs } from "./format.js";

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
  /** True when the loan is late but still inside the grace window, so mora is zero. */
  graceApplied: boolean;
  moraGraceDays: number;
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
      graceApplied: derived.graceApplied,
      moraGraceDays: snapshot.terms.moraPolicy.moraGraceDays,
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

/**
 * "Pagos recibidos" needs date + time (the Pencil ledger shows "27 may 2026,
 * 3:00 p.m."), unlike every other date cell in this report which is
 * date-only — a dedicated formatter local to this table.
 */
function formatDateTimeEs(d: string | Date): string {
  const date = new Date(d);
  const datePart = formatDateEs(date);
  // es-DO renders "3:00 p. m." (space before the period) — Pencil's "3:00
  // p.m." drops that space; normalize it rather than hand-roll AM/PM math.
  const timePart = date
    .toLocaleTimeString("es-DO", { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/([ap])\.\s?m\./i, "$1.m.");
  return `${datePart}, ${timePart}`;
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

export function buildKpiCells(data: LoanStatementData): KpiCell[] {
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
      // A late loan inside the grace window shows RD$0.00 next to a non-zero "días de
      // atraso"; without naming the grace the two figures read as a contradiction.
      // Orange is the report's alarm colour, so a grace-waived zero must not wear it.
      subtext: kpis.graceApplied
        ? `Sin mora — dentro del período de gracia de ${kpis.moraGraceDays} ${kpis.moraGraceDays === 1 ? "día" : "días"}`
        : `${formatDop(kpis.grossMora)} generada − ${formatDop(kpis.collectedMora)} pagada`,
      emphasize: !kpis.graceApplied,
      ...(kpis.graceApplied ? { pill: { value: "En gracia", tone: "info" as const } } : {})
    },
    {
      label: "Días de atraso",
      value: `${kpis.daysOverdue}`,
      subtext: kpis.sinceDate ? `desde el ${formatDateEs(kpis.sinceDate)}` : "Al día",
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
        "El libro de pagos es consistente — cada peso recibido está correctamente sumado y ninguna cuota pagada falta por contar.",
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
    const aplicado = row.amountApplied;
    return {
      cells: {
        cuota: `${row.cuota}`,
        due: formatDateEs(row.dueDate),
        estado: "",
        cubierta: cubiertaElFor(row, data.kpis.cuota),
        monto: formatDop(data.kpis.cuota),
        aplicado: formatDop(aplicado)
      },
      status: { column: "estado", value: estado.label, tone: estado.tone },
      cellVariants: aplicado === 0 ? { aplicado: "moneyMuted" } : undefined,
      highlight: row.status === "PARTIAL"
    };
  });
}

function buildReceivedPaymentsRows(data: LoanStatementData): TableRow[] {
  return data.receivedPayments.map((p) => ({
    cells: {
      fecha: formatDateTimeEs(p.paidAt),
      tipo: PAYMENT_KIND_LABELS[p.kind] ?? p.kind,
      monto: formatDop(p.amount),
      metodo: p.method ? (PAYMENT_METHOD_LABELS[p.method] ?? p.method) : "—"
    }
  }));
}

function buildReconciliationNoteLines(data: LoanStatementData): string[] {
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
  lines.push("Cifras generadas por el motor de cálculo del sistema, no estimadas a mano.");
  return lines;
}

const SCHEDULE_COLUMNS: TableColumn[] = [
  { key: "cuota", header: "Cuota", weight: 0.6, variant: "primary" },
  { key: "due", header: "Vence", weight: 1.1, variant: "secondary" },
  { key: "estado", header: "Estado", weight: 1 },
  { key: "cubierta", header: "Cubierta el", weight: 1.9, variant: "secondary" },
  { key: "monto", header: "Monto cuota", weight: 1.1, align: "right", variant: "money" },
  { key: "aplicado", header: "Aplicado", weight: 1.1, align: "right", variant: "money" }
];

const RECEIVED_PAYMENTS_COLUMNS: TableColumn[] = [
  { key: "fecha", header: "Fecha", weight: 1.4, variant: "secondary" },
  { key: "tipo", header: "Tipo", weight: 0.9, variant: "secondary" },
  { key: "monto", header: "Monto", weight: 1, align: "right", variant: "money" },
  { key: "metodo", header: "Método", weight: 1, variant: "secondary" }
];

const SCHEDULE_ANNOTATION =
  '"Cubierta el" = fecha en que el total abonado alcanzó ese número de cuota.';

/**
 * Compose the loan-statement document from the canonical data model. Usually
 * 2 pages, but both tables can grow large over a long loan's life — the
 * schedule with `termLength` (hundreds of installments for a daily-frequency
 * loan) and the received-payments ledger with every payment ever made — so
 * both paginate from their own start, budgeted from real block geometry via
 * `layout.ts` (see that file's header for why: an unbudgeted overflow
 * crashes the renderer, issue #202's root cause).
 */
export function buildLoanStatementDocument(data: LoanStatementData): ReportDocument {
  const freqLabel = FREQ_LABELS[data.paymentFrequency] ?? data.paymentFrequency;
  const meta: BrandHeaderMeta[] = [
    { label: "Generado", value: formatDateEs(data.generatedAt) },
    {
      label: "Desembolso",
      value: data.disbursementDate ? formatDateEs(data.disbursementDate) : "—"
    },
    { label: "Frecuencia", value: freqLabel, tail: `· ${data.termLength} cuotas` }
  ];

  const firstPageAbove = [
    headerHeight(meta.length),
    verificationBannerHeight(2),
    kpiGridHeight(2, true)
  ];
  const scheduleRowPages = paginateRows(
    buildScheduleRows(data),
    tableRowBudget({ aboveHeights: firstPageAbove }),
    tableRowBudget({ includeSectionTitle: false })
  );

  // brandHeader/verificationBanner/kpiGrid AND the "Calendario de pagos"
  // section title only appear on the schedule's first page — continuation
  // pages are the bare table (its own header row repeats automatically) so
  // "Página N de M" in the footer is the only pagination indicator.
  const schedulePages: ReportElement[][] = scheduleRowPages.map((rows, i) => {
    const body: ReportElement[] = [];
    if (i === 0) {
      body.push(
        brandHeader({
          eyebrow: "Estado de cuenta",
          title: `Préstamo #${data.loanId}`,
          subtitle: data.customerName,
          meta
        }),
        buildVerificationBanner(data),
        kpiGrid({ cells: buildKpiCells(data), columns: 4 }),
        section("Calendario de pagos", [dataTable({ columns: SCHEDULE_COLUMNS, rows })], {
          annotation: SCHEDULE_ANNOTATION
        })
      );
    } else {
      body.push(dataTable({ columns: SCHEDULE_COLUMNS, rows }));
    }
    return body;
  });

  // The reconciliation card only appears once, on the very last "received
  // payments" page — reserve its height on every received page (order
  // doesn't affect the arithmetic; see `tableRowBudget`) so it always fits
  // regardless of which chunk ends up last.
  const receivedAbove = [verificationBannerHeight(3)];
  const receivedFirstBudget = tableRowBudget({ aboveHeights: receivedAbove });
  const receivedContinuationBudget = tableRowBudget({
    aboveHeights: receivedAbove,
    includeSectionTitle: false
  });
  const receivedRowPages = paginateRows(
    buildReceivedPaymentsRows(data),
    receivedFirstBudget,
    receivedContinuationBudget
  );

  const receivedPages: ReportElement[][] = receivedRowPages.map((rows, i) => {
    const isLast = i === receivedRowPages.length - 1;
    const body: ReportElement[] =
      i === 0
        ? [section("Pagos recibidos", [dataTable({ columns: RECEIVED_PAYMENTS_COLUMNS, rows })])]
        : [dataTable({ columns: RECEIVED_PAYMENTS_COLUMNS, rows })];
    if (isLast) {
      body.push(noteCard({ lines: buildReconciliationNoteLines(data) }));
    }
    return body;
  });

  const allPageBodies = [...schedulePages, ...receivedPages];
  const footerContext = `Mikro SRL — Préstamo #${data.loanId} · Generado ${formatDateEs(data.generatedAt)}`;

  return composeReportPages(allPageBodies, () => [footerContext]);
}

/** The loan-statement report: validated `{ ...BuildSnapshotInput }` in, JSON/PDF out. */
export const loanStatementReport: Report<LoanStatementData> = defineReport({
  name: "loan-statement",
  inputSchema: loanStatementInputSchema,
  buildData: buildLoanStatementData,
  toDocument: buildLoanStatementDocument
});
