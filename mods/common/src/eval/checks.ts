/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The collections spec, encoded as executable checks over a LoanSnapshot. This
 * registry IS the canonical spec (code-first); `generateSpecMarkdown` renders it
 * to prose so the doc can never drift from the code.
 *
 * Two classes of check, both required — the lesson from the #10034 partial-payment
 * bug (PR #138):
 *  - CONSISTENCY: recompute a derived number independently from the raw ledger and
 *    compare. Catches plumbing / row-selection bugs (the PARTIAL rows were excluded
 *    by a wrong status filter — right math, wrong input).
 *  - INVARIANT: pure arithmetic/policy assertions over the derived block. Catches
 *    engine bugs the engine cannot catch about itself (money conservation, mora
 *    never charged in grace, cap respected).
 */
// Direct file import, not the `../utils/index.js` barrel — see the note in
// snapshot.ts on why eval/ must never pull that barrel (RN/Jest safety).
import { countCuotasCovered } from "../utils/calculatePaymentStatus.js";
import { sumInstallmentPaid, type LoanSnapshot } from "./snapshot.js";

export type CheckSeverity = "critical" | "warning";
export type CheckClass = "consistency" | "invariant";

export interface CheckResult {
  id: string;
  title: string;
  severity: CheckSeverity;
  class: CheckClass;
  pass: boolean;
  expected: string;
  actual: string;
  explanation: string;
}

export interface Check {
  id: string;
  title: string;
  /** Why this rule exists — rendered into the generated spec and read by the LLM explainer. */
  rationale: string;
  severity: CheckSeverity;
  class: CheckClass;
  run(s: LoanSnapshot): Omit<CheckResult, "id" | "title" | "severity" | "class">;
}

/** Money comparisons tolerate sub-cent float noise. */
const EPS = 0.01;
const approxEq = (a: number, b: number): boolean => Math.abs(a - b) <= EPS;

export const COLLECTIONS_CHECKS: Check[] = [
  {
    id: "pending-count",
    title: "Pending payments reconcile with money paid",
    rationale:
      "Cuotas covered must equal floor(total installment money paid / cuota), and pending must equal term minus that. This is the exact invariant the #10034 bug violated: PARTIAL rows were excluded, freezing the count.",
    severity: "critical",
    class: "consistency",
    run(s) {
      const totalPaid = sumInstallmentPaid(
        s.ledger.map((l) => ({ ...l, paidAt: new Date(l.paidAt) })),
        new Date(s.asOf)
      );
      const expectedCovered = Math.min(
        countCuotasCovered(totalPaid, s.terms.cuota),
        s.terms.termLength
      );
      const expectedPending = Math.max(0, s.terms.termLength - expectedCovered);
      const pass =
        s.derived.cuotasCovered === expectedCovered &&
        s.derived.pendingPayments === expectedPending;
      return {
        pass,
        expected: `covered=${expectedCovered}, pending=${expectedPending}`,
        actual: `covered=${s.derived.cuotasCovered}, pending=${s.derived.pendingPayments}`,
        explanation: `RD$${totalPaid.toFixed(2)} paid ÷ RD$${s.terms.cuota} cuota = ${expectedCovered} of ${s.terms.termLength} cuotas covered.`
      };
    }
  },
  {
    id: "money-conservation",
    title: "Installments paid plus balance equal the total obligation",
    rationale:
      "The total repayment obligation is term × cuota. Money paid toward installments plus the remaining balance must equal it (unless the customer overpaid, in which case balance is zero). Independent of the counting engine.",
    severity: "critical",
    class: "invariant",
    run(s) {
      const obligation = s.terms.termLength * s.terms.cuota;
      const paid = s.derived.totalInstallmentPaid;
      const bal = s.derived.remainingBalance;
      const pass = paid > obligation ? approxEq(bal, 0) : approxEq(paid + bal, obligation);
      return {
        pass,
        expected: `paid + balance = ${obligation.toFixed(2)} (or balance=0 if overpaid)`,
        actual: `paid=${paid.toFixed(2)} + balance=${bal.toFixed(2)} = ${(paid + bal).toFixed(2)}`,
        explanation: `Obligation is ${s.terms.termLength} × RD$${s.terms.cuota} = RD$${obligation.toFixed(2)}.`
      };
    }
  },
  {
    id: "balance-consistency",
    title: "Remaining balance matches obligation minus money paid",
    rationale:
      "remainingBalance must equal max(0, term·cuota − total installment paid). The prestamo screen once derived balance from disbursed principal instead, disagreeing with every other screen.",
    severity: "critical",
    class: "consistency",
    run(s) {
      const expected = Math.max(
        0,
        s.terms.termLength * s.terms.cuota - s.derived.totalInstallmentPaid
      );
      const pass = approxEq(s.derived.remainingBalance, expected);
      return {
        pass,
        expected: expected.toFixed(2),
        actual: s.derived.remainingBalance.toFixed(2),
        explanation: `max(0, ${s.terms.termLength}·${s.terms.cuota} − ${s.derived.totalInstallmentPaid.toFixed(2)}).`
      };
    }
  },
  {
    id: "cuotas-covered-bounds",
    title: "Cuotas covered stay within [0, term]",
    rationale:
      "Overpayment must cap coverage at the term, and coverage can never go negative. A loan can never be more than fully paid.",
    severity: "critical",
    class: "invariant",
    run(s) {
      const c = s.derived.cuotasCovered;
      const pass = c >= 0 && c <= s.terms.termLength;
      return {
        pass,
        expected: `0 ≤ covered ≤ ${s.terms.termLength}`,
        actual: `${c}`,
        explanation: pass
          ? "Within bounds."
          : "Coverage out of range — overpay cap or floor failed."
      };
    }
  },
  {
    id: "reversed-and-pending-excluded",
    title: "Reversed and pending rows never count toward cuotas",
    rationale:
      "Only COMPLETED and PARTIAL INSTALLMENT rows count. Money paid must exclude REVERSED (undone) and PENDING (unsettled) rows, otherwise reversed payments phantom-advance the loan.",
    severity: "critical",
    class: "consistency",
    run(s) {
      const asOf = new Date(s.asOf).getTime();
      const countable = s.ledger
        .filter(
          (l) =>
            l.kind === "INSTALLMENT" &&
            (l.status === "COMPLETED" || l.status === "PARTIAL") &&
            new Date(l.paidAt).getTime() <= asOf
        )
        .reduce((sum, l) => sum + l.amount, 0);
      const pass = approxEq(countable, s.derived.totalInstallmentPaid);
      const excluded = s.ledger.filter(
        (l) => l.kind === "INSTALLMENT" && (l.status === "REVERSED" || l.status === "PENDING")
      ).length;
      return {
        pass,
        expected: `totalInstallmentPaid = ${countable.toFixed(2)} (COMPLETED+PARTIAL only)`,
        actual: s.derived.totalInstallmentPaid.toFixed(2),
        explanation: `${excluded} reversed/pending installment row(s) present; none may be counted.`
      };
    }
  },
  {
    id: "no-future-payments-counted",
    title: "Payments dated after as-of are not counted",
    rationale:
      "Cycle metrics and totals are as-of a date. A payment recorded with a future paidAt must not advance the loan or reduce the balance for an earlier evaluation instant.",
    severity: "warning",
    class: "consistency",
    run(s) {
      const asOf = new Date(s.asOf).getTime();
      const futureCounted = s.ledger.filter(
        (l) => l.countsTowardCuotas && new Date(l.paidAt).getTime() > asOf
      );
      const withFuture = s.ledger
        .filter(
          (l) => l.kind === "INSTALLMENT" && (l.status === "COMPLETED" || l.status === "PARTIAL")
        )
        .reduce((sum, l) => sum + l.amount, 0);
      const pass =
        futureCounted.length === 0 ? true : !approxEq(withFuture, s.derived.totalInstallmentPaid);
      return {
        pass,
        expected: "future-dated payments excluded from totalInstallmentPaid",
        actual: `${futureCounted.length} future countable row(s); total=${s.derived.totalInstallmentPaid.toFixed(2)}`,
        explanation:
          futureCounted.length === 0
            ? "No future-dated payments present."
            : "Future-dated payments exist — total must exclude them."
      };
    }
  },
  {
    id: "mora-grace-respected",
    title: "No mora inside the grace window",
    rationale:
      "Mora must not accrue while days-late is at or below the grace period. Charging mora during grace is exactly the phantom-mora spiral #10034 suffered.",
    severity: "critical",
    class: "invariant",
    run(s) {
      const inGrace = s.derived.daysLate <= s.terms.moraPolicy.moraGraceDays;
      const pass = !inGrace || s.derived.grossMora === 0;
      return {
        pass,
        expected: inGrace ? "grossMora = 0 (within grace)" : "n/a (past grace)",
        actual: `daysLate=${s.derived.daysLate}, grace=${s.terms.moraPolicy.moraGraceDays}, grossMora=${s.derived.grossMora}`,
        explanation: inGrace
          ? "Loan is within the grace window; no mora may be charged."
          : "Loan is past grace; mora accrual is permitted."
      };
    }
  },
  {
    id: "mora-cap-respected",
    title: "Mora never exceeds the cap",
    rationale:
      "Gross mora is capped at moraCapInCuotas × cuota (the minimum-DOP floor may raise a small positive mora to the floor, so the ceiling is max(cap, floor)).",
    severity: "critical",
    class: "invariant",
    run(s) {
      const cap = s.terms.moraPolicy.moraCapInCuotas * s.terms.cuota;
      const ceiling = Math.max(cap > 0 ? cap : Infinity, s.terms.moraPolicy.moraMinDop);
      const pass = s.derived.grossMora <= ceiling + EPS;
      return {
        pass,
        expected: `grossMora ≤ ${Number.isFinite(ceiling) ? ceiling.toFixed(2) : "∞"}`,
        actual: s.derived.grossMora.toFixed(2),
        explanation: `Cap is ${s.terms.moraPolicy.moraCapInCuotas} × RD$${s.terms.cuota} = RD$${cap.toFixed(2)}.`
      };
    }
  },
  {
    id: "mora-only-when-behind",
    title: "Mora only accrues when cycles are missed",
    rationale:
      "A customer who is current (zero missed cycles) must owe zero mora. Mora with no missed cycle means the cycle counter and the mora engine disagree.",
    severity: "critical",
    class: "invariant",
    run(s) {
      const pass = s.derived.moraAccrued <= EPS || s.derived.missedCycles > 0;
      return {
        pass,
        expected: "moraAccrued > 0 ⟹ missedCycles > 0",
        actual: `moraAccrued=${s.derived.moraAccrued}, missedCycles=${s.derived.missedCycles}`,
        explanation:
          s.derived.missedCycles > 0
            ? "Customer is behind; mora is expected."
            : "Customer is current; mora must be zero."
      };
    }
  },
  {
    id: "mora-net-nonneg",
    title: "Net mora equals gross minus collected, never negative",
    rationale:
      "moraAccrued (net owed) must equal max(0, grossMora − collectedMora). A negative or mismatched net means collected LATE_FEE was double-counted or ignored.",
    severity: "warning",
    class: "invariant",
    run(s) {
      const expected = Math.max(0, s.derived.grossMora - s.derived.collectedMora);
      const pass = approxEq(s.derived.moraAccrued, expected);
      return {
        pass,
        expected: expected.toFixed(2),
        actual: s.derived.moraAccrued.toFixed(2),
        explanation: `max(0, gross ${s.derived.grossMora} − collected ${s.derived.collectedMora}).`
      };
    }
  },
  {
    id: "fully-paid-has-no-dues",
    title: "A fully paid loan owes nothing further",
    rationale:
      "When cuotas covered reach the term, pending payments and remaining balance must both be zero. A fully paid loan still showing dues is a UI/logic contradiction.",
    severity: "warning",
    class: "invariant",
    run(s) {
      const pass =
        !s.derived.fullyPaid ||
        (s.derived.pendingPayments === 0 && approxEq(s.derived.remainingBalance, 0));
      return {
        pass,
        expected: s.derived.fullyPaid ? "pending=0 and balance=0" : "n/a (not fully paid)",
        actual: `pending=${s.derived.pendingPayments}, balance=${s.derived.remainingBalance.toFixed(2)}`,
        explanation: s.derived.fullyPaid
          ? "Loan is fully covered; no dues may remain."
          : "Loan is not fully paid."
      };
    }
  }
];

/** Total number of registered checks. */
export const CHECK_COUNT = COLLECTIONS_CHECKS.length;
