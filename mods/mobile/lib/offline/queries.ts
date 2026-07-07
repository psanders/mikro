/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  getCycleMetrics,
  getDueDateForCycle,
  type LoanPaymentData
} from "@mikro/common/utils/calculatePaymentStatus";
import { daysLateFromOldestDue, computeAccruedMora } from "@mikro/common/utils/lateFee";
import { getDatabase } from "./database";

// -- Sync metadata --

export function getLastSyncTime(): string | null {
  const db = getDatabase();
  const row = db.getFirstSync<{ value: string }>(
    "SELECT value FROM sync_meta WHERE key = 'last_pull_at'"
  );
  return row?.value ?? null;
}

export function getCollectorInfo(): { id: string; name: string } | null {
  const db = getDatabase();
  const id = db.getFirstSync<{ value: string }>(
    "SELECT value FROM sync_meta WHERE key = 'collector_id'"
  );
  const name = db.getFirstSync<{ value: string }>(
    "SELECT value FROM sync_meta WHERE key = 'collector_name'"
  );
  if (!id || !name) return null;
  return { id: id.value, name: name.value };
}

function getMoraConfig() {
  const db = getDatabase();
  const row = db.getFirstSync<{ value: string }>(
    "SELECT value FROM sync_meta WHERE key = 'mora_config'"
  );
  if (!row) {
    return {
      defaultMoraRate: 0.1,
      moraGraceDays: 0,
      moraCapInCuotas: 1,
      moraMinDop: 0,
      moraStopOnDefault: false,
      moraEffectiveFrom: null as string | null
    };
  }
  return JSON.parse(row.value) as {
    defaultMoraRate: number;
    moraGraceDays: number;
    moraCapInCuotas: number;
    moraMinDop: number;
    moraStopOnDefault: boolean;
    moraEffectiveFrom: string | null;
  };
}

// -- Pending mutations --

export function getPendingMutationCount(): number {
  const db = getDatabase();
  const row = db.getFirstSync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM pending_mutations WHERE status IN ('pending', 'failed')"
  );
  return row?.cnt ?? 0;
}

export function getPendingMutationBreakdown(): { payments: number; notes: number } {
  const db = getDatabase();
  const payments = db.getFirstSync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM pending_mutations WHERE type = 'createPayment' AND status IN ('pending', 'failed')"
  );
  const notes = db.getFirstSync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM pending_mutations WHERE type = 'createLoanNote' AND status IN ('pending', 'failed')"
  );
  return {
    payments: payments?.cnt ?? 0,
    notes: notes?.cnt ?? 0
  };
}

// -- Table counts --

export function getCustomerCount(): number {
  const db = getDatabase();
  const row = db.getFirstSync<{ cnt: number }>("SELECT COUNT(*) as cnt FROM customers");
  return row?.cnt ?? 0;
}

export function getLoanCount(): number {
  const db = getDatabase();
  const row = db.getFirstSync<{ cnt: number }>("SELECT COUNT(*) as cnt FROM loans");
  return row?.cnt ?? 0;
}

// -- Dashboard --

interface LoanRow {
  id: string;
  loan_id: number;
  status: string;
  payment_amount: number;
  payment_frequency: string;
  term_length: number;
  mora_rate: number | null;
  starting_date: string | null;
  nickname: string | null;
  customer_id: string;
  created_at: string;
  updated_at: string;
  customer_name: string;
  collection_point: string | null;
  home_address: string;
  preferred_payment_day: string | null;
}

interface PaymentRow {
  paid_at: string;
  status: string;
  kind: string;
  amount: number;
  loan_id: string;
}

export interface DashboardVisit {
  loanId: number;
  customerId: string;
  customerName: string;
  loanNickname: string | null;
  address: string;
  paymentAmount: number;
  installmentNumber: number;
  termLength: number;
  /** Repayment still owed: term x cuota minus installment money collected (>= 0). */
  remainingBalance: number;
  /** True when the next cuota's due date is today or earlier (day-of-week route model). */
  dueToday: boolean;
  isOverdue: boolean;
  daysOverdue: number;
  paidToday: boolean;
  amountPaidToday: number;
  nextDueDate: string;
}

export interface CollectorDashboard {
  collector: { id: string; name: string };
  dailyTarget: number;
  amountCollected: number;
  visitsDone: number;
  visitsPending: number;
  visits: DashboardVisit[];
}

// Computes per-loan visit metrics for an arbitrary set of loans, independent of
// which collector is assigned. The collector-scoped dashboard and the
// customer/loan detail screens all build on top of this so they stay consistent.
function buildVisitsForLoans(
  db: ReturnType<typeof getDatabase>,
  loans: LoanRow[],
  now: Date
): DashboardVisit[] {
  if (loans.length === 0) return [];

  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const loanIds = loans.map((l) => l.id);
  const placeholders = loanIds.map(() => "?").join(", ");
  const allPayments = db.getAllSync<PaymentRow>(
    `SELECT p.paid_at, p.status, p.kind, p.amount, p.loan_id
     FROM payments p
     WHERE p.status != 'REVERSED' AND p.loan_id IN (${placeholders})`,
    loanIds
  );

  const paymentsByLoan = new Map<string, PaymentRow[]>();
  for (const p of allPayments) {
    const existing = paymentsByLoan.get(p.loan_id) ?? [];
    existing.push(p);
    paymentsByLoan.set(p.loan_id, existing);
  }

  const todayPayments = allPayments.filter((p) => {
    const paidAt = new Date(p.paid_at);
    return (
      paidAt >= startOfDay &&
      paidAt <= endOfDay &&
      (p.kind === "INSTALLMENT" || p.kind === "LATE_FEE")
    );
  });

  const paidLoanIds = new Set<string>();
  const paidAmountByLoan = new Map<string, number>();
  for (const p of todayPayments) {
    paidLoanIds.add(p.loan_id);
    paidAmountByLoan.set(p.loan_id, (paidAmountByLoan.get(p.loan_id) ?? 0) + p.amount);
  }

  return loans.map((l) => {
    const loanPayments = paymentsByLoan.get(l.id) ?? [];
    // COMPLETED + PARTIAL: cycle counting is money-based, so partials
    // accumulate toward completed cuotas.
    const installmentPayments = loanPayments.filter(
      (p) =>
        (!p.kind || p.kind === "INSTALLMENT") &&
        (p.status === "COMPLETED" || p.status === "PARTIAL")
    );

    const loanStart = new Date(l.starting_date ?? l.created_at);
    const loanData: LoanPaymentData = {
      paymentFrequency: l.payment_frequency,
      createdAt: new Date(l.created_at),
      startingDate: l.starting_date ? new Date(l.starting_date) : null,
      termLength: l.term_length,
      paymentAmount: l.payment_amount,
      payments: installmentPayments.map((p) => ({
        paidAt: new Date(p.paid_at),
        status: p.status,
        amount: p.amount
      })),
      preferredPaymentDay: l.preferred_payment_day ?? null
    };

    const metrics = getCycleMetrics(loanData, now);
    const paid = paidLoanIds.has(l.id);
    const totalInstallmentPaid = installmentPayments.reduce((s, p) => s + p.amount, 0);
    const remainingBalance = Math.max(0, l.payment_amount * l.term_length - totalInstallmentPaid);

    const daysOverdue =
      !paid && metrics.missedCycles > 0
        ? daysLateFromOldestDue(
            loanStart,
            l.payment_frequency,
            l.preferred_payment_day ?? null,
            metrics.paymentsMade,
            metrics.missedCycles,
            now
          )
        : 0;

    const nextDue = getDueDateForCycle(
      loanStart,
      metrics.paymentsMade,
      l.payment_frequency,
      l.preferred_payment_day ?? null
    );

    const dueToday = nextDue.getTime() <= endOfDay.getTime();

    return {
      loanId: l.loan_id,
      customerId: l.customer_id,
      customerName: l.customer_name,
      loanNickname: l.nickname,
      address: l.collection_point ?? l.home_address,
      paymentAmount: l.payment_amount,
      installmentNumber: metrics.paymentsMade + 1,
      termLength: l.term_length,
      remainingBalance,
      dueToday,
      isOverdue: !paid && daysOverdue > 0,
      daysOverdue: paid ? 0 : daysOverdue,
      paidToday: paid,
      amountPaidToday: paidAmountByLoan.get(l.id) ?? 0,
      nextDueDate: nextDue.toISOString()
    };
  });
}

function sortVisits(visits: DashboardVisit[]): void {
  visits.sort((a, b) => {
    if (a.paidToday !== b.paidToday) return a.paidToday ? 1 : -1;
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    if (a.daysOverdue !== b.daysOverdue) return b.daysOverdue - a.daysOverdue;
    return a.customerName.localeCompare(b.customerName);
  });
}

export function getCollectorDashboard(): CollectorDashboard | null {
  const collector = getCollectorInfo();
  if (!collector) return null;

  const db = getDatabase();
  const now = new Date();

  const loans = db.getAllSync<LoanRow>(
    `SELECT l.*, c.name as customer_name, c.collection_point, c.home_address, c.preferred_payment_day
     FROM loans l
     JOIN customers c ON l.customer_id = c.id
     WHERE l.status = 'ACTIVE' AND c.assigned_collector_id = ?`,
    [collector.id]
  );

  const visits = buildVisitsForLoans(db, loans, now);

  // Day-of-week route model: today's meta covers only customers due today or
  // overdue (plus what was already collected today) — a customer due next week
  // is not part of today's goal. The ask per loan is capped at what's left.
  const dailyTarget = visits.reduce((sum, v) => {
    if (v.paidToday) return sum + v.amountPaidToday;
    if (v.dueToday || v.isOverdue) return sum + Math.min(v.paymentAmount, v.remainingBalance);
    return sum;
  }, 0);
  const amountCollected = visits.reduce((sum, v) => sum + v.amountPaidToday, 0);
  // "Cobros" counts customers, not loans: a customer with several loans is a
  // single visit. Done = distinct customers collected today; pending = those
  // still due today (or overdue) and not yet collected.
  const paidCustomerIds = new Set(visits.filter((v) => v.paidToday).map((v) => v.customerId));
  const dueCustomerIds = new Set(
    visits
      .filter((v) => !v.paidToday && (v.dueToday || v.isOverdue) && v.remainingBalance > 0)
      .map((v) => v.customerId)
  );
  const visitsDone = paidCustomerIds.size;
  const visitsPending = [...dueCustomerIds].filter((id) => !paidCustomerIds.has(id)).length;

  sortVisits(visits);

  return {
    collector,
    dailyTarget,
    amountCollected,
    visitsDone,
    visitsPending,
    visits
  };
}

// Loans for a single customer, regardless of which collector they're assigned
// to. Powers the customer detail screen so any collector can see full data for
// anyone they search.
export function getCustomerLoans(customerId: string): DashboardVisit[] {
  const db = getDatabase();
  const now = new Date();

  const loans = db.getAllSync<LoanRow>(
    `SELECT l.*, c.name as customer_name, c.collection_point, c.home_address, c.preferred_payment_day
     FROM loans l
     JOIN customers c ON l.customer_id = c.id
     WHERE l.status = 'ACTIVE' AND l.customer_id = ?`,
    [customerId]
  );

  const visits = buildVisitsForLoans(db, loans, now);
  sortVisits(visits);
  return visits;
}

// Visit metrics for a single loan, regardless of collector assignment. Powers
// the loan/cobro/visita/historico screens so they work for any customer.
export function getLoanVisit(loanId: number): DashboardVisit | null {
  const db = getDatabase();
  const now = new Date();

  const loans = db.getAllSync<LoanRow>(
    `SELECT l.*, c.name as customer_name, c.collection_point, c.home_address, c.preferred_payment_day
     FROM loans l
     JOIN customers c ON l.customer_id = c.id
     WHERE l.loan_id = ?`,
    [loanId]
  );

  const visits = buildVisitsForLoans(db, loans, now);
  return visits[0] ?? null;
}

// -- Customer queries --

export interface CustomerRow {
  id: string;
  name: string;
  nickname: string | null;
  phone: string;
  idNumber: string;
  collectionPoint: string | null;
  homeAddress: string;
  preferredPaymentDay: string | null;
  isActive: boolean;
  createdAt: string;
}

export function getCustomer(id: string): CustomerRow | null {
  const db = getDatabase();
  const row = db.getFirstSync<{
    id: string;
    name: string;
    nickname: string | null;
    phone: string;
    id_number: string;
    collection_point: string | null;
    home_address: string;
    preferred_payment_day: string | null;
    is_active: number;
    created_at: string;
  }>("SELECT * FROM customers WHERE id = ?", [id]);

  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    nickname: row.nickname,
    phone: row.phone,
    idNumber: row.id_number,
    collectionPoint: row.collection_point,
    homeAddress: row.home_address,
    preferredPaymentDay: row.preferred_payment_day,
    isActive: row.is_active === 1,
    createdAt: row.created_at
  };
}

export function searchCustomers(query: string, limit = 20): CustomerRow[] {
  const db = getDatabase();
  const pattern = `%${query}%`;
  const rows = db.getAllSync<{
    id: string;
    name: string;
    nickname: string | null;
    phone: string;
    id_number: string;
    collection_point: string | null;
    home_address: string;
    preferred_payment_day: string | null;
    is_active: number;
    created_at: string;
  }>(
    `SELECT * FROM customers
     WHERE name LIKE ? OR nickname LIKE ? OR phone LIKE ?
     ORDER BY name ASC LIMIT ?`,
    [pattern, pattern, pattern, limit]
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    nickname: row.nickname,
    phone: row.phone,
    idNumber: row.id_number,
    collectionPoint: row.collection_point,
    homeAddress: row.home_address,
    preferredPaymentDay: row.preferred_payment_day,
    isActive: row.is_active === 1,
    createdAt: row.created_at
  }));
}

// -- Loan queries --

export interface LoanDetail {
  id: string;
  loanId: number;
  status: string;
  principal: number;
  termLength: number;
  paymentAmount: number;
  paymentFrequency: string;
  moraRate: number | null;
  startingDate: string | null;
  nickname: string | null;
  customerId: string;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    name: string;
    nickname: string | null;
    phone: string;
    homeAddress: string;
    collectionPoint: string | null;
    preferredPaymentDay: string | null;
  };
}

export function getLoanByLoanId(loanId: number): LoanDetail | null {
  const db = getDatabase();
  const row = db.getFirstSync<{
    id: string;
    loan_id: number;
    status: string;
    principal: number;
    term_length: number;
    payment_amount: number;
    payment_frequency: string;
    mora_rate: number | null;
    starting_date: string | null;
    nickname: string | null;
    customer_id: string;
    created_at: string;
    updated_at: string;
    c_id: string;
    c_name: string;
    c_nickname: string | null;
    c_phone: string;
    c_home_address: string;
    c_collection_point: string | null;
    c_preferred_payment_day: string | null;
  }>(
    `SELECT l.*,
            c.id as c_id, c.name as c_name, c.nickname as c_nickname, c.phone as c_phone,
            c.home_address as c_home_address, c.collection_point as c_collection_point,
            c.preferred_payment_day as c_preferred_payment_day
     FROM loans l
     JOIN customers c ON l.customer_id = c.id
     WHERE l.loan_id = ?`,
    [loanId]
  );

  if (!row) return null;
  return {
    id: row.id,
    loanId: row.loan_id,
    status: row.status,
    principal: row.principal,
    termLength: row.term_length,
    paymentAmount: row.payment_amount,
    paymentFrequency: row.payment_frequency,
    moraRate: row.mora_rate,
    startingDate: row.starting_date,
    nickname: row.nickname,
    customerId: row.customer_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    customer: {
      id: row.c_id,
      name: row.c_name,
      nickname: row.c_nickname,
      phone: row.c_phone,
      homeAddress: row.c_home_address,
      collectionPoint: row.c_collection_point,
      preferredPaymentDay: row.c_preferred_payment_day
    }
  };
}

// -- Payment queries --

export interface PaymentDetail {
  id: string;
  amount: number;
  paidAt: string;
  method: string;
  status: string;
  kind: string;
  linkedPaymentId: string | null;
  notes: string | null;
  loanId: string;
  collectedById: string;
  createdAt: string;
}

export function listPaymentsByLoanId(loanId: number, showReversed = false): PaymentDetail[] {
  const db = getDatabase();
  const loan = db.getFirstSync<{ id: string }>("SELECT id FROM loans WHERE loan_id = ?", [loanId]);
  if (!loan) return [];

  const statusFilter = showReversed ? "" : "AND p.status != 'REVERSED'";
  const rows = db.getAllSync<{
    id: string;
    amount: number;
    paid_at: string;
    method: string;
    status: string;
    kind: string;
    linked_payment_id: string | null;
    notes: string | null;
    loan_id: string;
    collected_by_id: string;
    created_at: string;
  }>(`SELECT * FROM payments p WHERE p.loan_id = ? ${statusFilter} ORDER BY p.paid_at DESC`, [
    loan.id
  ]);

  return rows.map((r) => ({
    id: r.id,
    amount: r.amount,
    paidAt: r.paid_at,
    method: r.method,
    status: r.status,
    kind: r.kind,
    linkedPaymentId: r.linked_payment_id,
    notes: r.notes,
    loanId: r.loan_id,
    collectedById: r.collected_by_id,
    createdAt: r.created_at
  }));
}

export function listPaymentsByCustomer(
  customerId: string,
  startDate: Date,
  endDate: Date
): PaymentDetail[] {
  const db = getDatabase();
  const rows = db.getAllSync<{
    id: string;
    amount: number;
    paid_at: string;
    method: string;
    status: string;
    kind: string;
    linked_payment_id: string | null;
    notes: string | null;
    loan_id: string;
    collected_by_id: string;
    created_at: string;
  }>(
    `SELECT p.* FROM payments p
     JOIN loans l ON p.loan_id = l.id
     WHERE l.customer_id = ? AND p.paid_at >= ? AND p.paid_at <= ? AND p.status != 'REVERSED'
     ORDER BY p.paid_at DESC`,
    [customerId, startDate.toISOString(), endDate.toISOString()]
  );

  return rows.map((r) => ({
    id: r.id,
    amount: r.amount,
    paidAt: r.paid_at,
    method: r.method,
    status: r.status,
    kind: r.kind,
    linkedPaymentId: r.linked_payment_id,
    notes: r.notes,
    loanId: r.loan_id,
    collectedById: r.collected_by_id,
    createdAt: r.created_at
  }));
}

export function listPayments(startDate: Date, endDate: Date): PaymentDetail[] {
  const db = getDatabase();
  const rows = db.getAllSync<{
    id: string;
    amount: number;
    paid_at: string;
    method: string;
    status: string;
    kind: string;
    linked_payment_id: string | null;
    notes: string | null;
    loan_id: string;
    collected_by_id: string;
    created_at: string;
  }>(
    `SELECT * FROM payments
     WHERE paid_at >= ? AND paid_at <= ?
     ORDER BY paid_at DESC`,
    [startDate.toISOString(), endDate.toISOString()]
  );

  return rows.map((r) => ({
    id: r.id,
    amount: r.amount,
    paidAt: r.paid_at,
    method: r.method,
    status: r.status,
    kind: r.kind,
    linkedPaymentId: r.linked_payment_id,
    notes: r.notes,
    loanId: r.loan_id,
    collectedById: r.collected_by_id,
    createdAt: r.created_at
  }));
}

// Most recent non-reversed payment time (ISO) across all of a customer's loans,
// or null if none. Used to block collectors from double-charging the same
// customer within a short window.
export function getLastCustomerPaymentAt(customerId: string): string | null {
  const db = getDatabase();
  const row = db.getFirstSync<{ paid_at: string }>(
    `SELECT p.paid_at FROM payments p
     JOIN loans l ON p.loan_id = l.id
     WHERE l.customer_id = ? AND p.status != 'REVERSED'
     ORDER BY p.paid_at DESC LIMIT 1`,
    [customerId]
  );
  return row?.paid_at ?? null;
}

// -- Late fee preview --

export interface PreviewLateFeeResult {
  accruedMora: number;
  grossMora: number;
  collectedMora: number;
  daysLate: number;
  missedCycles: number;
  cuota: number;
  suggestedTotal: number;
  moraRate: number;
}

export function previewLateFee(loanId: number): PreviewLateFeeResult | null {
  const db = getDatabase();
  const loan = db.getFirstSync<{
    id: string;
    payment_amount: number;
    payment_frequency: string;
    term_length: number;
    mora_rate: number | null;
    starting_date: string | null;
    created_at: string;
    updated_at: string;
    status: string;
    preferred_payment_day: string | null;
  }>(
    `SELECT l.*, c.preferred_payment_day
     FROM loans l JOIN customers c ON l.customer_id = c.id
     WHERE l.loan_id = ?`,
    [loanId]
  );
  if (!loan) return null;

  const payments = db.getAllSync<{
    paid_at: string;
    status: string;
    kind: string;
    amount: number;
  }>(
    "SELECT paid_at, status, kind, amount FROM payments WHERE loan_id = ? AND status != 'REVERSED'",
    [loan.id]
  );

  const cfg = getMoraConfig();
  const moraRate = loan.mora_rate ?? cfg.defaultMoraRate;
  const cuota = loan.payment_amount;
  const loanStart = new Date(loan.starting_date ?? loan.created_at);

  const installmentPayments = payments
    .filter((p) => !p.kind || p.kind === "INSTALLMENT")
    .map((p) => ({ paidAt: new Date(p.paid_at), status: p.status, amount: p.amount }));

  const loanData: LoanPaymentData = {
    paymentFrequency: loan.payment_frequency,
    createdAt: new Date(loan.created_at),
    startingDate: loan.starting_date ? new Date(loan.starting_date) : null,
    termLength: loan.term_length,
    paymentAmount: cuota,
    payments: installmentPayments,
    preferredPaymentDay: loan.preferred_payment_day ?? null
  };

  const collectedLateFeePayments = payments
    .filter((p) => p.kind === "LATE_FEE" && p.status !== "REVERSED")
    .map((p) => ({
      paidAt: new Date(p.paid_at),
      amount: p.amount,
      status: p.status
    }));

  const accrued = computeAccruedMora({
    loanData,
    moraRate,
    paymentAmount: cuota,
    paymentFrequency: loan.payment_frequency,
    preferredPaymentDay: loan.preferred_payment_day ?? null,
    loanStart,
    asOfDate: new Date(),
    loanStatus: loan.status as "ACTIVE" | "COMPLETED" | "DEFAULTED" | "CANCELLED",
    loanUpdatedAt: new Date(loan.updated_at),
    policy: cfg,
    collectedLateFeePayments
  });

  return {
    accruedMora: accrued.moraAmount,
    grossMora: accrued.grossMoraAmount,
    collectedMora: accrued.collectedMora,
    daysLate: accrued.daysLate,
    missedCycles: accrued.missedCycles,
    cuota,
    suggestedTotal: cuota + accrued.moraAmount,
    moraRate
  };
}
