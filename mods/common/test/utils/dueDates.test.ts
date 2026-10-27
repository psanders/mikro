/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * One due-date source (#384): quincenal 15th / month-end, monthly without
 * overflow, weekly every 7 days, and the legacy first-due path for loans that
 * predate `firstDueDate`. The engine (cycle metrics, mora, schedule) and the
 * contract clause must all agree with these dates.
 */
import { expect } from "chai";
import {
  snapFirstDueDate,
  getInstallmentDueDate,
  resolveFirstDueDate,
  getLoanDueDate
} from "../../src/utils/dueDates.js";
import { getCycleMetrics, type LoanPaymentData } from "../../src/utils/calculatePaymentStatus.js";
import { computeAccruedMora } from "../../src/utils/lateFee.js";
import { buildRepaymentSchedule } from "../../src/reporting/schedule.js";
import { buildLoanSnapshot } from "../../src/eval/snapshot.js";
import { contractDueDates, contractScheduleClause } from "../../src/contracts/generator.js";
import type { PaymentFrequency } from "../../src/utils/calculateLoan.js";
import type { ContractData } from "../../src/contracts/types.js";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const day = (date: Date) => date.toISOString().slice(0, 10);
const series = (first: string, n: number, freq: PaymentFrequency, monthDay?: number) =>
  Array.from({ length: n }, (_, i) => day(getInstallmentDueDate(d(first), i, freq, monthDay)));
const DAY_MS = 24 * 60 * 60 * 1000;

describe("dueDates", () => {
  describe("snapFirstDueDate", () => {
    it("snaps a quincenal first cuota forward to the next 15th or month-end", () => {
      expect(day(snapFirstDueDate(d("2026-11-10"), "BIWEEKLY"))).to.equal("2026-11-15");
      expect(day(snapFirstDueDate(d("2026-11-16"), "BIWEEKLY"))).to.equal("2026-11-30");
      expect(day(snapFirstDueDate(d("2027-02-16"), "BIWEEKLY"))).to.equal("2027-02-28");
      expect(day(snapFirstDueDate(d("2028-02-16"), "BIWEEKLY"))).to.equal("2028-02-29");
      expect(day(snapFirstDueDate(d("2026-11-15"), "BIWEEKLY"))).to.equal("2026-11-15");
      expect(day(snapFirstDueDate(d("2026-11-30"), "BIWEEKLY"))).to.equal("2026-11-30");
    });

    it("leaves other frequencies on their day, truncated to the UTC day", () => {
      for (const f of ["DAILY", "WEEKLY", "MONTHLY"] as const) {
        expect(snapFirstDueDate(new Date("2026-11-10T17:45:00Z"), f).toISOString()).to.equal(
          "2026-11-10T00:00:00.000Z"
        );
      }
    });
  });

  describe("getInstallmentDueDate", () => {
    it("runs quincenal cuotas on the 15th and the last day of each month", () => {
      expect(series("2026-11-15", 6, "BIWEEKLY")).to.deep.equal([
        "2026-11-15",
        "2026-11-30",
        "2026-12-15",
        "2026-12-31",
        "2027-01-15",
        "2027-01-31"
      ]);
      expect(series("2026-12-20", 3, "BIWEEKLY")).to.deep.equal([
        "2026-12-31",
        "2027-01-15",
        "2027-01-31"
      ]);
    });

    it("keeps monthly cuotas on the first cuota's day, clamped, without overflow", () => {
      expect(series("2026-11-30", 5, "MONTHLY")).to.deep.equal([
        "2026-11-30",
        "2026-12-30",
        "2027-01-30",
        "2027-02-28",
        "2027-03-30"
      ]);
      expect(series("2028-01-31", 4, "MONTHLY")).to.deep.equal([
        "2028-01-31",
        "2028-02-29",
        "2028-03-31",
        "2028-04-30"
      ]);
      expect(series("2026-12-31", 3, "MONTHLY")).to.deep.equal([
        "2026-12-31",
        "2027-01-31",
        "2027-02-28"
      ]);
    });

    it("runs weekly cuotas every 7 days from the first cuota", () => {
      // Wed 2026-11-04; a FRIDAY preference no longer moves anything.
      expect(series("2026-11-04", 5, "WEEKLY")).to.deep.equal([
        "2026-11-04",
        "2026-11-11",
        "2026-11-18",
        "2026-11-25",
        "2026-12-02"
      ]);
    });

    it("runs daily cuotas every day", () => {
      expect(series("2026-12-30", 3, "DAILY")).to.deep.equal([
        "2026-12-30",
        "2026-12-31",
        "2027-01-01"
      ]);
    });
  });

  describe("resolveFirstDueDate (existing loans, no firstDueDate)", () => {
    const loan = (startingDate: string, paymentFrequency: PaymentFrequency) => ({
      startingDate: d(startingDate),
      createdAt: d(startingDate),
      paymentFrequency
    });

    it("keeps a quincenal anchor already on the cycle and snaps one that isn't", () => {
      expect(day(resolveFirstDueDate(loan("2026-10-01", "BIWEEKLY")))).to.equal("2026-10-15");
      expect(day(resolveFirstDueDate(loan("2026-02-24", "BIWEEKLY")))).to.equal("2026-03-15");
      expect(
        [0, 1, 2].map((i) => day(getLoanDueDate(loan("2026-10-01", "BIWEEKLY"), i)))
      ).to.deep.equal(["2026-10-15", "2026-10-31", "2026-11-15"]);
    });

    it("gives a weekly loan anchor + 7 days whatever the preferred day", () => {
      // Mon 2026-01-05; the customer prefers FRIDAY (ignored).
      expect(day(resolveFirstDueDate(loan("2026-01-05", "WEEKLY")))).to.equal("2026-01-12");
    });

    it("keeps a monthly loan on the anchor's day of month", () => {
      const l = loan("2026-01-31", "MONTHLY");
      expect(day(resolveFirstDueDate(l))).to.equal("2026-02-28");
      expect(day(getLoanDueDate(l, 1))).to.equal("2026-03-31");
    });

    it("falls back to createdAt and uses firstDueDate when the loan has one", () => {
      expect(
        day(
          resolveFirstDueDate({
            startingDate: null,
            createdAt: new Date("2026-10-01T15:30:00Z"),
            paymentFrequency: "WEEKLY"
          })
        )
      ).to.equal("2026-10-08");
      expect(
        day(
          resolveFirstDueDate({
            firstDueDate: d("2026-11-30"),
            startingDate: d("2026-10-01"),
            createdAt: d("2026-10-01"),
            paymentFrequency: "MONTHLY"
          })
        )
      ).to.equal("2026-11-30");
    });
  });

  describe("engine consumers agree with getLoanDueDate", () => {
    const FIRSTS = ["01", "15", "16", "29", "30", "31"].map((dd) => `2026-01-${dd}`);
    FIRSTS.push("2026-02-10", "2026-02-28");
    const TERM = 6;
    const CUOTA = 500;
    const POLICY = {
      moraRate: 0.1,
      moraGraceDays: 0,
      moraCapInCuotas: 1,
      moraMinDop: 0,
      moraStopOnDefault: false,
      moraEffectiveFrom: null
    };

    /** Anchor that resolves to `first` under the legacy path (first − 1 period). */
    function anchorFor(first: string, freq: PaymentFrequency): Date {
      const f = d(first);
      if (freq === "WEEKLY") return new Date(f.getTime() - 7 * DAY_MS);
      if (freq === "BIWEEKLY") return new Date(f.getTime() - 14 * DAY_MS);
      return new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() - 1, f.getUTCDate()));
    }

    for (const freq of ["WEEKLY", "BIWEEKLY", "MONTHLY"] as const) {
      for (const first of FIRSTS) {
        const anchor = anchorFor(first, freq);
        // MONTHLY anchors that overflow (e.g. 31 − 1 month) don't round-trip; skip them.
        if (freq === "MONTHLY" && anchor.getUTCDate() !== d(first).getUTCDate()) continue;

        it(`${freq} first cuota ${first}`, () => {
          const loanData: LoanPaymentData = {
            paymentFrequency: freq,
            createdAt: anchor,
            startingDate: anchor,
            termLength: TERM,
            paymentAmount: CUOTA,
            payments: []
          };
          const dues = Array.from({ length: TERM }, (_, i) => getLoanDueDate(loanData, i));
          expect(day(dues[0])).to.equal(day(snapFirstDueDate(d(first), freq)));

          const snapshotAt = (asOf: Date) =>
            buildLoanSnapshot({
              loanId: 1,
              loan: {
                status: "ACTIVE",
                principal: 2500,
                termLength: TERM,
                paymentAmount: CUOTA,
                paymentFrequency: freq,
                createdAt: anchor,
                startingDate: anchor,
                updatedAt: anchor,
                closedAt: null,
                nickname: null
              },
              customer: { id: "C1", name: "X", preferredPaymentDay: "FRIDAY" },
              payments: [],
              policy: POLICY,
              asOf
            });

          const schedule = buildRepaymentSchedule(snapshotAt(dues[TERM - 1]));
          dues.forEach((due, i) => {
            const before = new Date(due.getTime() - DAY_MS);
            expect(getCycleMetrics(loanData, before).cyclesElapsed, `cuota ${i} eve`).to.equal(i);
            expect(getCycleMetrics(loanData, due).cyclesElapsed, `cuota ${i} day`).to.equal(i + 1);
            expect(schedule[i].dueDate.slice(0, 10), `schedule row ${i}`).to.equal(day(due));
          });

          // Nothing paid: mora counts from cuota 0's due date.
          const asOf = new Date(dues[2].getTime() + 3 * DAY_MS);
          const mora = computeAccruedMora({
            loanData,
            moraRate: 0.1,
            paymentAmount: CUOTA,
            paymentFrequency: freq,
            preferredPaymentDay: "FRIDAY",
            loanStart: anchor,
            asOfDate: asOf,
            loanStatus: "ACTIVE",
            policy: POLICY
          });
          expect(mora.daysLate).to.equal(Math.round((asOf.getTime() - dues[0].getTime()) / DAY_MS));
        });
      }
    }
  });

  describe("day boundary", () => {
    it("rolls a cuota over at UTC midnight, whatever the process TZ", () => {
      // WEEKLY anchor 10-25 → dues 11-01, 11-08, 11-15 (cuota 2).
      const loanData: LoanPaymentData = {
        paymentFrequency: "WEEKLY",
        createdAt: d("2026-10-25"),
        startingDate: d("2026-10-25"),
        payments: []
      };
      expect(day(getLoanDueDate(loanData, 2))).to.equal("2026-11-15");
      // 14 nov 20:30 AST: cuota 2 is due.
      expect(getCycleMetrics(loanData, new Date("2026-11-15T00:30:00Z")).cyclesElapsed).to.equal(3);
      // 14 nov 19:30 AST: not yet.
      expect(getCycleMetrics(loanData, new Date("2026-11-14T23:30:00Z")).cyclesElapsed).to.equal(2);
    });
  });

  describe("contract clause", () => {
    const base = (startDate: string, frequency: PaymentFrequency, installments: number) =>
      ({
        debtor: { name: "X", cedula: "000-0000000-0", city: "Santo Domingo" },
        principal: 2000,
        installments,
        frequency,
        installmentAmount: 500,
        startDate: new Date(startDate),
        contractDate: new Date("2026-10-01T12:00:00Z")
      }) as ContractData;

    let savedTz: string | undefined;
    beforeEach(() => (savedTz = process.env.TZ));
    afterEach(() => {
      if (savedTz === undefined) delete process.env.TZ;
      else process.env.TZ = savedTz;
    });

    for (const tz of ["America/Santo_Domingo", "UTC"]) {
      describe(`TZ=${tz}`, () => {
        beforeEach(() => (process.env.TZ = tz));

        it("prints the quincenal first and last cuota on the 15th / month-end", () => {
          const data = base("2026-10-15T00:00:00Z", "BIWEEKLY", 5);
          const { first, last } = contractDueDates(data);
          expect(day(first)).to.equal("2026-10-15");
          expect(day(last)).to.equal(day(getInstallmentDueDate(first, 4, "BIWEEKLY")));
          const clause = contractScheduleClause(data);
          expect(clause).to.contain("a partir del día 15 de octubre del año 2026");
          expect(clause).to.contain("culminar el día 15 de diciembre del año 2026");
          expect(clause).to.contain(
            "CUOTAS QUINCENALES, PAGADERAS LOS DÍAS QUINCE (15) Y ÚLTIMO DE CADA MES,"
          );
        });

        it("snaps an off-cycle quincenal start forward", () => {
          const clause = contractScheduleClause(base("2026-11-10T12:00:00", "BIWEEKLY", 2));
          expect(clause).to.contain("a partir del día 15 de noviembre del año 2026");
          expect(clause).to.contain("culminar el día 30 de noviembre del año 2026");
        });

        it("ends a monthly contract on a clamped day instead of overflowing", () => {
          const data = base("2026-11-30T00:00:00Z", "MONTHLY", 4);
          const clause = contractScheduleClause(data);
          expect(clause).to.contain("a partir del día 30 de noviembre del año 2026");
          expect(clause).to.contain("culminar el día 28 de febrero del año 2027");
          expect(clause).to.contain(
            "CUOTAS MENSUALES, PAGADERAS EL DÍA TREINTA (30) DE CADA MES " +
              "(O EL ÚLTIMO DÍA DEL MES CUANDO ESTE NO LO TENGA),"
          );
        });

        it("leaves weekly and daily wording as it was", () => {
          const weekly = contractScheduleClause(base("2026-11-04T00:00:00Z", "WEEKLY", 5));
          expect(weekly).to.contain("CUOTAS SEMANALES, CON UN VALOR DE");
          expect(weekly).to.contain("culminar el día 2 de diciembre del año 2026");
          const daily = contractScheduleClause(base("2026-12-30T00:00:00Z", "DAILY", 3));
          expect(daily).to.contain("CUOTAS DIARIAS, CON UN VALOR DE");
          expect(daily).to.contain("culminar el día 1 de enero del año 2027");
        });
      });
    }
  });
});
