/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { addPaymentPeriod, subtractPaymentPeriod, reopenActionLabel } from "../applications";

const FREQS = ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"] as const;

describe("reopenActionLabel", () => {
  it("sends an approved application back to evaluations", () => {
    expect(reopenActionLabel("APPROVED")).toBe("Regresar a evaluaciones");
  });

  it("reopens a rejected (or any non-approved) application", () => {
    expect(reopenActionLabel("REJECTED")).toBe("Reabrir solicitud");
    expect(reopenActionLabel("IN_REVIEW")).toBe("Reabrir solicitud");
  });
});

describe("payment-period date math", () => {
  it("advances by the correct number of days per frequency", () => {
    const base = new Date(2026, 6, 4); // 2026-07-04
    expect(addPaymentPeriod(base, "DAILY").getDate()).toBe(5);
    expect(addPaymentPeriod(base, "WEEKLY").getDate()).toBe(11);
    expect(addPaymentPeriod(base, "BIWEEKLY").getDate()).toBe(18);
    const monthly = addPaymentPeriod(base, "MONTHLY");
    expect(monthly.getMonth()).toBe(7); // August
    expect(monthly.getDate()).toBe(4);
  });

  it("subtract is the inverse of add for every frequency", () => {
    const base = new Date(2026, 6, 4);
    for (const f of FREQS) {
      expect(subtractPaymentPeriod(addPaymentPeriod(base, f), f).getTime()).toBe(base.getTime());
    }
  });

  it("the schedule invariant holds: start + period lands on the chosen first cuota", () => {
    // Reviewer picks a first-cuota date; we store startingDate = firstPayment -
    // one period, and the loan schedule computes cuota #1 as startingDate +
    // one period. That round-trip must return the exact picked date.
    const firstPayment = new Date(2026, 6, 20);
    for (const f of FREQS) {
      const start = subtractPaymentPeriod(firstPayment, f);
      expect(addPaymentPeriod(start, f).getTime()).toBe(firstPayment.getTime());
    }
  });
});
