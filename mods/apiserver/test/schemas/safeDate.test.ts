/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Regression coverage for the loan #10035 incident: bad/null date inputs
 * used to be silently coerced to the Unix epoch by `z.coerce.date().optional()`,
 * which then made days-late / mora calculations explode. The shared
 * `safeOptionalDate` / `safeRequiredDate` helpers now drop or reject those
 * inputs instead.
 */
import { expect } from "chai";
import {
  safeOptionalDate,
  safeRequiredDate,
  createLoanSchema,
  previewLateFeeSchema,
  createPaymentSchema
} from "@mikro/common";

const VALID_CUSTOMER_ID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_COLLECTOR_ID = "11111111-1111-4111-8111-111111111111";

const baseLoanInput = {
  customerId: VALID_CUSTOMER_ID,
  principal: 5000,
  termLength: 10,
  paymentAmount: 650,
  paymentFrequency: "WEEKLY" as const
};

describe("safeOptionalDate", () => {
  it("returns undefined for undefined", () => {
    expect(safeOptionalDate.parse(undefined)).to.equal(undefined);
  });

  it("returns undefined for null (does NOT coerce to epoch)", () => {
    expect(safeOptionalDate.parse(null)).to.equal(undefined);
  });

  it("returns undefined for empty string", () => {
    expect(safeOptionalDate.parse("")).to.equal(undefined);
    expect(safeOptionalDate.parse("   ")).to.equal(undefined);
  });

  it("rejects unparseable strings instead of silently returning undefined", () => {
    expect(() => safeOptionalDate.parse("not-a-date")).to.throw();
    expect(() => safeOptionalDate.parse("hoy")).to.throw();
  });

  it("rejects Invalid Date instances", () => {
    expect(() => safeOptionalDate.parse(new Date("nope"))).to.throw();
  });

  it("accepts ISO date strings", () => {
    const d = safeOptionalDate.parse("2026-03-15");
    expect(d).to.be.instanceOf(Date);
    expect((d as Date).toISOString().slice(0, 10)).to.equal("2026-03-15");
  });

  it("accepts Date instances", () => {
    const input = new Date("2026-03-15T12:00:00Z");
    expect(safeOptionalDate.parse(input)?.getTime()).to.equal(input.getTime());
  });

  it("accepts numeric timestamps in range", () => {
    const t = Date.UTC(2026, 0, 1);
    expect(safeOptionalDate.parse(t)?.getTime()).to.equal(t);
  });

  it("rejects Date(0) / epoch explicitly via min-date refinement", () => {
    expect(() => safeOptionalDate.parse(new Date(0))).to.throw();
  });

  it("rejects pre-2020 ISO dates", () => {
    expect(() => safeOptionalDate.parse("1999-12-31")).to.throw();
  });
});

describe("safeRequiredDate", () => {
  it("rejects undefined", () => {
    expect(() => safeRequiredDate.parse(undefined)).to.throw();
  });

  it("rejects null (does NOT coerce to epoch)", () => {
    expect(() => safeRequiredDate.parse(null)).to.throw();
  });

  it("rejects empty string", () => {
    expect(() => safeRequiredDate.parse("")).to.throw();
  });

  it("rejects Invalid Date", () => {
    expect(() => safeRequiredDate.parse(new Date("invalid"))).to.throw();
  });

  it("rejects epoch", () => {
    expect(() => safeRequiredDate.parse(new Date(0))).to.throw();
  });

  it("accepts valid ISO string", () => {
    const d = safeRequiredDate.parse("2026-05-01");
    expect(d).to.be.instanceOf(Date);
    expect(d.getUTCFullYear()).to.equal(2026);
  });
});

describe("createLoanSchema startingDate hardening", () => {
  it("treats wire-level null as missing instead of coercing to 1970-01-01", () => {
    const parsed = createLoanSchema.parse({ ...baseLoanInput, startingDate: null });
    expect(parsed.startingDate).to.equal(undefined);
  });

  it("treats empty string as missing", () => {
    const parsed = createLoanSchema.parse({ ...baseLoanInput, startingDate: "" });
    expect(parsed.startingDate).to.equal(undefined);
  });

  it("rejects epoch-valued startingDate", () => {
    expect(() =>
      createLoanSchema.parse({ ...baseLoanInput, startingDate: new Date(0) })
    ).to.throw();
  });

  it("accepts a real ISO startingDate", () => {
    const parsed = createLoanSchema.parse({ ...baseLoanInput, startingDate: "2026-04-01" });
    expect(parsed.startingDate).to.be.instanceOf(Date);
    expect((parsed.startingDate as Date).toISOString().slice(0, 10)).to.equal("2026-04-01");
  });
});

describe("previewLateFeeSchema asOf hardening", () => {
  it("drops null instead of coercing asOf to epoch", () => {
    const parsed = previewLateFeeSchema.parse({ loanId: 10035, asOf: null });
    expect(parsed.asOf).to.equal(undefined);
  });
});

describe("createPaymentSchema paidAt hardening", () => {
  it("drops null instead of coercing paidAt to epoch", () => {
    const parsed = createPaymentSchema.parse({
      loanId: 10035,
      amount: 1300,
      collectedById: VALID_COLLECTOR_ID,
      paidAt: null
    });
    expect(parsed.paidAt).to.equal(undefined);
  });
});
