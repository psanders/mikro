/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Calibration must weight recent cohorts over the early noisy book and map
 * db facts onto the Modelo engine's ProjectionConfig prefill.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect } from "chai";
import {
  blendCollectionRate,
  calibrateFromDb,
  cohortLabel,
  cohortStartMonth
} from "../../src/modelo/calibrate.js";

const AS_OF = "2026-07-26";

function seedDb(path: string): void {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE loans (
      id TEXT PRIMARY KEY, loan_id INTEGER, status TEXT, principal DECIMAL,
      term_length INTEGER, payment_amount DECIMAL, payment_frequency TEXT,
      starting_date DATETIME, created_at DATETIME, updated_at DATETIME,
      type TEXT, mora_rate DECIMAL, nickname TEXT, customer_id TEXT
    );
    CREATE TABLE payments (
      id TEXT PRIMARY KEY, loan_id TEXT, amount DECIMAL, kind TEXT,
      status TEXT, paid_at DATETIME, method TEXT, notes TEXT,
      linked_payment_id TEXT, collected_by_id TEXT,
      created_at DATETIME, updated_at DATETIME
    );
    CREATE TABLE accounting_transactions (
      id TEXT PRIMARY KEY, type TEXT, status TEXT, amount DECIMAL,
      occurred_at DATETIME, description TEXT, vendor TEXT, reference TEXT,
      reversal_of_id TEXT, account_id TEXT, to_account_id TEXT,
      category_id TEXT, created_by_id TEXT, created_at DATETIME, updated_at DATETIME
    );
  `);

  const loan = db.prepare(
    `INSERT INTO loans (id, loan_id, status, principal, term_length, payment_amount,
       payment_frequency, starting_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const payment = db.prepare(
    `INSERT INTO payments (id, loan_id, amount, kind, status, paid_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const tx = db.prepare(
    `INSERT INTO accounting_transactions (id, type, status, amount, occurred_at)
     VALUES (?, ?, ?, ?, ?)`
  );

  // Old cohort (Jan): 5,000 × 10 weekly cuotas of 650 — fully due, badly paid,
  // one default with zero recovery.
  loan.run("L1", 1, "ACTIVE", 5000, 10, 650, "WEEKLY", "2026-01-10", "2026-01-10");
  payment.run("P1", "L1", 1300, "INSTALLMENT", "COMPLETED", "2026-01-24");
  loan.run("L2", 2, "DEFAULTED", 5000, 10, 650, "WEEKLY", "2026-01-15", "2026-01-15");

  // Recent cohort (Jun): same shape, paying well; one late fee event.
  // By 2026-07-26, ~6 cuotas due (3,900), 3,250 collected → 83.3%.
  loan.run("L3", 3, "ACTIVE", 5000, 10, 650, "WEEKLY", "2026-06-12", "2026-06-12");
  payment.run("P2", "L3", 3250, "INSTALLMENT", "COMPLETED", "2026-07-20");
  payment.run("P3", "L3", 65, "LATE_FEE", "COMPLETED", "2026-07-20");
  // Reversed payments must be ignored.
  payment.run("P4", "L3", 9999, "INSTALLMENT", "REVERSED", "2026-07-21");
  // Cancelled loans must be ignored entirely.
  loan.run("L4", 4, "CANCELLED", 7777, 10, 650, "WEEKLY", "2026-06-12", "2026-06-12");

  tx.run("T1", "EXPENSE", "COMPLETED", 10000, "2026-06-05");
  tx.run("T2", "EXPENSE", "COMPLETED", 14000, "2026-07-05");
  tx.run("T3", "DEPOSIT", "COMPLETED", 30000, "2026-07-06");
  tx.run("T4", "EXPENSE", "REVERSED", 5000, "2026-07-07");
  db.close();
}

describe("modelo/calibrate", () => {
  let dir: string;
  let dbPath: string;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), "mikro-modelo-"));
    dbPath = join(dir, "fixture.db");
    seedDb(dbPath);
  });

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("buckets loans into calendar-aligned cohort windows", () => {
    expect(cohortStartMonth(new Date(2026, 0, 15), 2)).to.equal("2026-01");
    expect(cohortStartMonth(new Date(2026, 1, 15), 2)).to.equal("2026-01");
    expect(cohortStartMonth(new Date(2026, 5, 12), 2)).to.equal("2026-05");
    expect(cohortLabel("2026-05", 2)).to.equal("2026-05..2026-06");
    expect(cohortLabel("2026-05", 1)).to.equal("2026-05");
  });

  it("weights newer cohorts double per step in the blended rate", () => {
    const mk = (dueToDate: number, collectionRate: number) =>
      ({ dueToDate, collectionRate }) as Parameters<typeof blendCollectionRate>[0][number];
    // Equal volume: newer cohort counts twice as much → (0.4 + 2×0.8)/3.
    expect(blendCollectionRate([mk(100, 0.4), mk(100, 0.8)])).to.be.closeTo(2 / 3, 1e-9);
    expect(blendCollectionRate([])).to.equal(0);
  });

  it("calibrates cohorts, facts, and prefill from the db", async () => {
    const cal = await calibrateFromDb({ dbPath, asOf: AS_OF, cohortMonths: 2, recentCohorts: 1 });

    expect(cal.cohorts.map((c) => c.label)).to.deep.equal(["2026-01..2026-02", "2026-05..2026-06"]);
    const [old, recent] = cal.cohorts;
    expect(old.loans).to.equal(2);
    expect(old.dueToDate).to.equal(13000); // both loans fully due
    expect(old.collected).to.equal(1300);
    expect(old.defaultedLoans).to.equal(1);
    expect(recent.loans).to.equal(1);
    expect(recent.dueToDate).to.equal(6 * 650);
    expect(recent.collected).to.equal(3250); // reversed payment ignored

    // recentCohorts: 1 → only the June cohort drives the calibration.
    expect(cal.facts.collectionRate).to.be.closeTo(3250 / 3900, 1e-9);
    expect(cal.facts.lossRate).to.be.closeTo(5000 / 15000, 1e-9);
    expect(cal.facts.lateShare).to.be.closeTo(1, 1e-9); // 1 late fee / 1 installment event
    expect(cal.facts.opexMonthlyAvg).to.equal(12000); // reversed expense ignored

    expect(cal.prefill.prestamoPromedio).to.equal(5000);
    expect(cal.prefill.tasaInteres).to.equal(0.3);
    expect(cal.prefill.plazoBase).to.equal(10);
    expect(cal.prefill.frecuenciaPago).to.equal("SEMANAL");
    expect(cal.prefill.tasaDefault).to.equal(0.33);
    expect(cal.prefill.gastosFijosMensuales).to.equal(12000);
    // Ledger cash 30,000 − 24,000 = 6,000, plus outstanding principal on L1+L3
    // discounted by the collection rate: street money is not all coming back.
    const outstanding = 5000 * ((6500 - 1300) / 6500) + 5000 * ((6500 - 3250) / 6500);
    expect(cal.prefill.inversionInicial).to.equal(
      Math.round(6000 + outstanding * cal.facts.collectionRate)
    );
  });

  it("prefills tasaDefault from the collection rate, not just written-off loans", async () => {
    const cal = await calibrateFromDb({ dbPath, asOf: AS_OF, cohortMonths: 2, recentCohorts: 1 });
    // 83.3% collected on the recent cohort is far worse than the 33% formal
    // loss rate implies for future lending, and the assumed-recovery prefill
    // must land between the two extremes.
    expect(cal.defaultRate.ifNoPastDueIsCollected).to.be.greaterThan(
      cal.defaultRate.atAssumedRecovery
    );
    expect(cal.defaultRate.atAssumedRecovery).to.be.greaterThanOrEqual(
      cal.defaultRate.ifAllPastDueIsCollected
    );
    expect(cal.prefill.tasaDefault).to.equal(
      Math.round(cal.defaultRate.atAssumedRecovery * 100) / 100
    );
  });
});
