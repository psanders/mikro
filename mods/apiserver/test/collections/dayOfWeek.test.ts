/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Tests for isPaymentDayToday (expanded signature) and formatPaymentDayForTemplate.
 */
import { expect } from "chai";
import { isPaymentDayToday, formatPaymentDayForTemplate } from "../../src/collections/dayOfWeek.js";

describe("isPaymentDayToday", () => {
  describe("DAILY", () => {
    it("always returns true", () => {
      const startingDate = new Date("2026-01-01");
      expect(isPaymentDayToday("DAILY", null, startingDate, new Date("2026-01-05"))).to.be.true;
      expect(isPaymentDayToday("DAILY", "FRIDAY", startingDate, new Date("2026-01-06"))).to.be.true;
    });
  });

  describe("WEEKLY", () => {
    it("returns true on preferred FRIDAY when today is Friday", () => {
      // Jan 9 2026 is a Friday
      const startingDate = new Date("2026-01-01");
      expect(isPaymentDayToday("WEEKLY", "FRIDAY", startingDate, new Date("2026-01-09"))).to.be
        .true;
    });

    it("returns false on preferred FRIDAY when today is Monday", () => {
      // Jan 5 2026 is a Monday
      const startingDate = new Date("2026-01-01");
      expect(isPaymentDayToday("WEEKLY", "FRIDAY", startingDate, new Date("2026-01-05"))).to.be
        .false;
    });
  });

  describe("BIWEEKLY", () => {
    it("returns true on day 14 from startingDate", () => {
      const startingDate = new Date("2026-01-01");
      // Day 14 = Jan 15
      expect(isPaymentDayToday("BIWEEKLY", null, startingDate, new Date("2026-01-15"))).to.be.true;
    });

    it("returns false on day 7 from startingDate", () => {
      const startingDate = new Date("2026-01-01");
      // Day 7 = Jan 8 (not a biweekly boundary)
      expect(isPaymentDayToday("BIWEEKLY", null, startingDate, new Date("2026-01-08"))).to.be.false;
    });

    it("returns true on day 28 from startingDate", () => {
      const startingDate = new Date("2026-01-01");
      // Day 28 = Jan 29
      expect(isPaymentDayToday("BIWEEKLY", null, startingDate, new Date("2026-01-29"))).to.be.true;
    });

    it("returns false on day 21 from startingDate", () => {
      const startingDate = new Date("2026-01-01");
      // Day 21 = Jan 22
      expect(isPaymentDayToday("BIWEEKLY", null, startingDate, new Date("2026-01-22"))).to.be.false;
    });
  });

  describe("MONTHLY", () => {
    it("returns true on matching day-of-month", () => {
      const startingDate = new Date("2026-01-15");
      expect(isPaymentDayToday("MONTHLY", null, startingDate, new Date("2026-02-15"))).to.be.true;
    });

    it("returns false on non-matching day-of-month", () => {
      const startingDate = new Date("2026-01-15");
      expect(isPaymentDayToday("MONTHLY", null, startingDate, new Date("2026-02-14"))).to.be.false;
    });

    it("returns true on Feb 28 for loan started Jan 31 (clamped)", () => {
      const startingDate = new Date("2026-01-31");
      // Feb has 28 days in 2026, so last day of month should match
      expect(isPaymentDayToday("MONTHLY", null, startingDate, new Date("2026-02-28"))).to.be.true;
    });

    it("returns false on Feb 27 for loan started Jan 31", () => {
      const startingDate = new Date("2026-01-31");
      expect(isPaymentDayToday("MONTHLY", null, startingDate, new Date("2026-02-27"))).to.be.false;
    });
  });
});

describe("formatPaymentDayForTemplate", () => {
  it("returns hoy for DAILY", () => {
    expect(formatPaymentDayForTemplate("DAILY", null, new Date("2026-01-01"))).to.equal("hoy");
  });

  it("returns Spanish day name for WEEKLY with preferred day", () => {
    expect(formatPaymentDayForTemplate("WEEKLY", "FRIDAY", new Date("2026-01-01"))).to.equal(
      "viernes"
    );
  });

  it("returns hoy for WEEKLY without preferred day", () => {
    expect(formatPaymentDayForTemplate("WEEKLY", null, new Date("2026-01-01"))).to.equal("hoy");
  });

  it("returns Spanish day name for BIWEEKLY with preferred day", () => {
    expect(formatPaymentDayForTemplate("BIWEEKLY", "MONDAY", new Date("2026-01-01"))).to.equal(
      "lunes"
    );
  });

  it("returns day-of-month string for MONTHLY", () => {
    const startingDate = new Date("2026-01-15");
    expect(formatPaymentDayForTemplate("MONTHLY", null, startingDate)).to.equal(
      "los 15 de cada mes"
    );
  });
});
