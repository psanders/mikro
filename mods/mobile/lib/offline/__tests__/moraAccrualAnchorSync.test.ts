/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * `moraAccrualFrom` is the frozen accrual window the server measured a LATE_FEE
 * charge over (see freeze-mora-accrual-window). The engine that reads it is
 * shared and already covered server-side against the real loan #10029 ledger
 * (mods/apiserver/test/utils/moraAccrualAnchor.test.ts). What is NOT covered
 * anywhere is that the value actually survives the trip an offline collector
 * app puts it through:
 *
 *   server sync payload -> mobile SQLite (migration + INSERT) -> local
 *   snapshot query (SELECT) -> engine
 *
 * so this test drives the real migration SQL (schema.ts), the real INSERT
 * (syncPull.ts, fed a payload shaped exactly like createCollectorSync.ts
 * emits) and the real SELECT (queries.ts) over an actual SQLite database
 * (better-sqlite3, standing in for expo-sqlite's synchronous API — same
 * engine as apiserver's hand-maintained SCHEMA_SQL tests). A mocked
 * getFirstSync/getAllSync — as loanSnapshotLocal.test.ts uses for its own,
 * narrower purpose — would not catch a broken column name, a dropped
 * migration, or a SELECT that forgets to project the field: the round trip
 * has to go through real SQL for that.
 *
 * If any link in the chain drops the field, this test reproduces the
 * original bug report (loan #10029: 76.00 charged, re-read as 68.00 with the
 * 8.00 difference clamped away) instead of the fixed numbers.
 */
import Database from "better-sqlite3";
import type { CollectorSyncResult } from "@mikro/apiserver/src/api/sync/createCollectorSync";

jest.mock("../database", () => ({ getDatabase: jest.fn() }));

import { getDatabase } from "../database";
import { runMigrations } from "../schema";
import { pullSync } from "../syncPull";
import { buildLoanSnapshotLocal } from "../queries";

/** Minimal synchronous adapter over better-sqlite3, matching the subset of
 * expo-sqlite's SQLiteDatabase surface the offline layer uses. */
function createSqliteAdapter() {
  const raw = new Database(":memory:");
  return {
    execSync(sql: string) {
      raw.exec(sql);
    },
    runSync(sql: string, params: unknown[] = []) {
      raw.prepare(sql).run(...params);
    },
    getFirstSync<T>(sql: string, params: unknown[] = []): T | null {
      return (raw.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    getAllSync<T>(sql: string, params: unknown[] = []): T[] {
      return raw.prepare(sql).all(...params) as T[];
    },
    withTransactionSync(fn: () => void) {
      raw.transaction(fn)();
    }
  };
}

const LOAN_UUID = "loan-uuid-10029";
const CUSTOMER_UUID = "cust-10029";
const LOAN_NO = 10029;
const CUOTA = 1200;
const LOAN_START = new Date(2026, 2, 15); // 15 mar 2026, BIWEEKLY, term 10
const on = (month: number, day: number, hour = 12) => new Date(2026, month - 1, day, hour);

/** Every INSTALLMENT payment recorded before and including the disputed charge. */
const INSTALLMENTS: Array<[Date, number]> = [
  [on(3, 15), 1200],
  [on(4, 2), 1200],
  [on(4, 16), 1200],
  [on(5, 1), 1200],
  [on(5, 30), 1176],
  [on(6, 17), 1128],
  [on(7, 2), 1140],
  [on(7, 17), 1200],
  [on(8, 5), 1124]
];

/** LATE_FEE money. The 5 ago charge is the one that froze its window. */
const CHARGE_ANCHOR = on(7, 17);
const FEES: Array<[Date, number]> = [
  [on(5, 30), 24],
  [on(6, 17), 72],
  [on(7, 2), 60],
  [on(8, 5), 76]
];

const AS_OF = on(8, 5, 23);

/** Builds a collectorSync payload shaped exactly like createCollectorSync.ts,
 * for loan #10029, optionally carrying the anchor on the disputed charge. */
function buildSyncPayload(opts: { anchored: boolean }): CollectorSyncResult {
  let seq = 0;
  const installmentRows = INSTALLMENTS.map(([at, amount]) => ({
    id: `pay-${seq++}`,
    amount,
    paidAt: at.toISOString(),
    method: "CASH",
    status: "COMPLETED",
    kind: "INSTALLMENT",
    moraAccrualFrom: null,
    linkedPaymentId: null,
    notes: null,
    loanId: LOAN_UUID,
    collectedById: "collector-1",
    createdAt: at.toISOString()
  }));
  const feeRows = FEES.map(([at, amount]) => ({
    id: `fee-${seq++}`,
    amount,
    paidAt: at.toISOString(),
    method: "CASH",
    status: "COMPLETED",
    kind: "LATE_FEE",
    // Only the 5 ago charge was written after anchoring shipped, mirroring
    // the real bug report and the server-side engine test.
    moraAccrualFrom:
      opts.anchored && at.getTime() === on(8, 5).getTime() ? CHARGE_ANCHOR.toISOString() : null,
    linkedPaymentId: null,
    notes: null,
    loanId: LOAN_UUID,
    collectedById: "collector-1",
    createdAt: at.toISOString()
  }));

  return {
    collector: { id: "collector-1", name: "Cobrador Prueba" },
    customers: [
      {
        id: CUSTOMER_UUID,
        name: "Cliente 10029",
        nickname: null,
        phone: "8095550000",
        idNumber: "001-0000000-0",
        collectionPoint: null,
        mapUrl: null,
        homeAddress: "Calle Falsa 123",
        preferredPaymentDay: null,
        assignedCollectorId: "collector-1",
        isActive: true,
        createdAt: LOAN_START.toISOString()
      }
    ],
    loans: [
      {
        id: LOAN_UUID,
        loanId: LOAN_NO,
        status: "ACTIVE",
        principal: CUOTA * 10,
        termLength: 10,
        paymentAmount: CUOTA,
        paymentFrequency: "BIWEEKLY",
        moraRate: null,
        startingDate: LOAN_START.toISOString(),
        nickname: null,
        customerId: CUSTOMER_UUID,
        createdAt: LOAN_START.toISOString(),
        updatedAt: AS_OF.toISOString(),
        payments: [...installmentRows, ...feeRows]
      }
    ],
    loanNotes: [],
    moraConfig: {
      defaultMoraRate: 0.1,
      moraGraceDays: 0,
      moraCapInCuotas: 1,
      moraMinDop: 0,
      moraStopOnDefault: true,
      moraEffectiveFrom: null
    },
    syncedAt: AS_OF.toISOString()
  };
}

function fakeApiClient(payload: CollectorSyncResult) {
  return { collectorSync: { query: async () => payload } } as never;
}

describe("mora accrual anchor survives server -> SQLite -> snapshot -> engine", () => {
  it("carries the frozen window through real migration, INSERT and SELECT: gross never falls below what was collected", async () => {
    const adapter = createSqliteAdapter();
    runMigrations(adapter as never);
    (getDatabase as jest.Mock).mockReturnValue(adapter);

    await pullSync(fakeApiClient(buildSyncPayload({ anchored: true })));

    const snap = buildLoanSnapshotLocal(LOAN_NO, AS_OF);
    expect(snap).not.toBeNull();
    expect(snap!.derived.daysLate).toBe(19);
    expect(snap!.derived.grossMora).toBe(76);
    expect(snap!.derived.collectedMora).toBe(76);
    expect(snap!.derived.moraAccrued).toBe(0);
    expect(snap!.derived.moraAccrualFrom).toBe(CHARGE_ANCHOR.toISOString());
  });

  it("regression check: without the anchor reaching the row, the same ledger reproduces the original bug (68 vs 76, 8.00 silently clamped away)", async () => {
    const adapter = createSqliteAdapter();
    runMigrations(adapter as never);
    (getDatabase as jest.Mock).mockReturnValue(adapter);

    await pullSync(fakeApiClient(buildSyncPayload({ anchored: false })));

    const snap = buildLoanSnapshotLocal(LOAN_NO, AS_OF);
    expect(snap).not.toBeNull();
    expect(snap!.derived.daysLate).toBe(17);
    expect(snap!.derived.grossMora).toBe(68);
    expect(snap!.derived.collectedMora).toBe(76);
    expect(snap!.derived.moraAccrued).toBe(0); // the 8.00 shortfall is clamped, exactly the bug
  });
});
