/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Phase 2 of the collections evaluation framework: mobile now builds the same
 * canonical loan snapshot the server does, over its local SQLite mirror, using
 * the identical `@mikro/common` builder. This proves the offline path produces
 * the same derived numbers (and keeps the full raw ledger, incl. reversed and
 * pending rows) without a live device — by faking the two SQL queries
 * `buildLoanSnapshotLocal` issues (mora_config lookup + loan/payments fetch).
 */
import { getDatabase } from "../database";
import { buildLoanSnapshotLocal, previewLateFee } from "../queries";

jest.mock("../database", () => ({ getDatabase: jest.fn() }));

const LOAN_ROW = {
  id: "loan-uuid-1",
  loan_id: 10099,
  status: "ACTIVE",
  principal: 4000,
  term_length: 4,
  payment_amount: 1000,
  payment_frequency: "WEEKLY",
  mora_rate: null as number | null,
  starting_date: "2026-06-01T00:00:00.000Z",
  nickname: null as string | null,
  customer_id: "cust-1",
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-15T12:00:00.000Z",
  customer_name: "Cliente Prueba",
  collection_point: null as string | null,
  home_address: "Calle Falsa 123",
  preferred_payment_day: null as string | null
};

const PAYMENT_ROWS = [
  {
    id: "p1",
    paid_at: "2026-06-02T10:00:00Z",
    status: "COMPLETED",
    kind: "INSTALLMENT",
    amount: 1000,
    method: "CASH",
    collected_by_id: "u1",
    linked_payment_id: null as string | null,
    notes: null as string | null
  },
  {
    id: "p2",
    paid_at: "2026-06-09T10:00:00Z",
    status: "COMPLETED",
    kind: "INSTALLMENT",
    amount: 1000,
    method: "CASH",
    collected_by_id: "u1",
    linked_payment_id: null as string | null,
    notes: null as string | null
  },
  {
    id: "p3-reversed",
    paid_at: "2026-06-05T10:00:00Z",
    status: "REVERSED",
    kind: "INSTALLMENT",
    amount: 5000,
    method: "CASH",
    collected_by_id: "u1",
    linked_payment_id: null as string | null,
    notes: "anulado"
  },
  {
    id: "p4-pending",
    paid_at: "2026-06-05T10:00:00Z",
    status: "PENDING",
    kind: "INSTALLMENT",
    amount: 5000,
    method: "CASH",
    collected_by_id: "u1",
    linked_payment_id: null as string | null,
    notes: null as string | null
  }
];

const AS_OF = new Date("2026-06-15T12:00:00.000Z"); // +14 days → 2 weekly cycles elapsed

function useMockDb(moraConfigRow: { value: string } | null) {
  const getFirstSync = jest.fn((sql: string, params?: unknown[]) => {
    if (sql.includes("sync_meta") && sql.includes("mora_config")) return moraConfigRow;
    if (sql.includes("FROM loans l JOIN customers c")) {
      const loanId = (params as [number])[0];
      return loanId === LOAN_ROW.loan_id ? LOAN_ROW : null;
    }
    throw new Error(`unexpected getFirstSync: ${sql}`);
  });
  const getAllSync = jest.fn((sql: string, params?: unknown[]) => {
    if (sql.includes("FROM payments WHERE loan_id = ?")) {
      const loanUuid = (params as [string])[0];
      return loanUuid === LOAN_ROW.id ? PAYMENT_ROWS : [];
    }
    throw new Error(`unexpected getAllSync: ${sql}`);
  });
  (getDatabase as jest.Mock).mockReturnValue({ getFirstSync, getAllSync });
}

describe("buildLoanSnapshotLocal", () => {
  afterEach(() => jest.clearAllMocks());

  it("keeps the full raw ledger (incl. reversed/pending) but excludes their money from derived", () => {
    useMockDb(null);
    const snap = buildLoanSnapshotLocal(10099, AS_OF);

    expect(snap).not.toBeNull();
    expect(snap!.ledger).toHaveLength(4); // all 4 rows present, unfiltered

    const reversed = snap!.ledger.find((l) => l.id === "p3-reversed")!;
    const pending = snap!.ledger.find((l) => l.id === "p4-pending")!;
    expect(reversed.countsTowardCuotas).toBe(false);
    expect(pending.countsTowardCuotas).toBe(false);

    expect(snap!.derived.totalInstallmentPaid).toBe(2000); // only the 2 COMPLETED rows
    expect(snap!.derived.cuotasCovered).toBe(2);
    expect(snap!.derived.pendingPayments).toBe(2);
    expect(snap!.derived.remainingBalance).toBe(2000); // 4*1000 - 2000
    expect(snap!.derived.missedCycles).toBe(0);
    expect(snap!.derived.moraAccrued).toBe(0);
  });

  it("falls back to default mora policy when no mora_config row is cached", () => {
    useMockDb(null);
    const snap = buildLoanSnapshotLocal(10099, AS_OF);
    expect(snap!.terms.moraPolicy).toEqual({
      moraRate: 0.1,
      moraGraceDays: 0,
      moraCapInCuotas: 1,
      moraMinDop: 0,
      moraStopOnDefault: false,
      moraEffectiveFrom: null
    });
  });

  it("uses the cached mora_config when present", () => {
    const cfg = {
      defaultMoraRate: 0.2,
      moraGraceDays: 3,
      moraCapInCuotas: 2,
      moraMinDop: 50,
      moraStopOnDefault: true,
      moraEffectiveFrom: null
    };
    useMockDb({ value: JSON.stringify(cfg) });
    const snap = buildLoanSnapshotLocal(10099, AS_OF);
    expect(snap!.terms.moraPolicy.moraRate).toBe(0.2);
    expect(snap!.terms.moraPolicy.moraGraceDays).toBe(3);
    expect(snap!.terms.moraPolicy.moraCapInCuotas).toBe(2);
  });

  it("returns null for a loan not in the local mirror", () => {
    useMockDb(null);
    expect(buildLoanSnapshotLocal(404)).toBeNull();
  });
});

describe("previewLateFee (delegates to the shared snapshot)", () => {
  afterEach(() => jest.clearAllMocks());

  it("matches the snapshot's derived mora numbers exactly", () => {
    useMockDb(null);
    // previewLateFee always uses the live clock (no asOf param), so compare
    // against a snapshot built the same way — not the fixed AS_OF fixture date.
    const snap = buildLoanSnapshotLocal(10099)!;
    const preview = previewLateFee(10099);

    expect(preview).not.toBeNull();
    expect(preview!.accruedMora).toBe(snap.derived.moraAccrued);
    expect(preview!.grossMora).toBe(snap.derived.grossMora);
    expect(preview!.collectedMora).toBe(snap.derived.collectedMora);
    expect(preview!.daysLate).toBe(snap.derived.daysLate);
    expect(preview!.missedCycles).toBe(snap.derived.missedCycles);
    expect(preview!.cuota).toBe(snap.terms.cuota);
    expect(preview!.moraRate).toBe(snap.terms.moraPolicy.moraRate);
    expect(preview!.suggestedTotal).toBe(snap.terms.cuota + snap.derived.moraAccrued);
  });

  it("returns null for a loan not in the local mirror", () => {
    useMockDb(null);
    expect(previewLateFee(404)).toBeNull();
  });
});
