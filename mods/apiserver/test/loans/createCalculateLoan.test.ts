/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { DEFAULT_LOAN_PRICING, ValidationError, getConfig } from "@mikro/common";
import { createCalculateLoan } from "../../src/api/loans/createCalculateLoan.js";
import { appRouter } from "../../src/trpc/routers/index.js";

describe("createCalculateLoan", () => {
  const calculateLoan = createCalculateLoan(DEFAULT_LOAN_PRICING);

  it("should calculate base option correctly for 5000 for 10 weekly periods", async () => {
    const result = await calculateLoan({
      principal: 5000,
      paymentFrequency: "WEEKLY",
      baseDuration: 10
    });

    const baseOption = result.options.find((option) => option.isBase);
    expect(baseOption).to.exist;
    expect(baseOption?.duration).to.equal(10);
    expect(baseOption?.interestRate).to.equal(0.3);
    expect(baseOption?.totalInterest).to.equal(1500);
    expect(baseOption?.totalRepay).to.equal(6500);
    expect(baseOption?.paymentPerPeriod).to.equal(650);
    expect(result.pricing).to.deep.equal(DEFAULT_LOAN_PRICING);
  });

  it("should decrease interest for shorter durations and increase for longer durations", async () => {
    const result = await calculateLoan({
      principal: 5000,
      paymentFrequency: "WEEKLY",
      baseDuration: 10
    });

    const shorter = result.options.find((option) => option.duration === 8);
    const longer = result.options.find((option) => option.duration === 12);

    expect(shorter).to.exist;
    expect(shorter?.interestRate).to.equal(0.27);
    expect(shorter?.totalRepay).to.equal(6350);
    expect(shorter?.paymentPerPeriod).to.equal(800);

    expect(longer).to.exist;
    expect(longer?.interestRate).to.equal(0.33);
    expect(longer?.totalRepay).to.equal(6650);
    expect(longer?.paymentPerPeriod).to.equal(600);
  });

  it("should accept a legacy call and ignore its rate fields", async () => {
    const result = await calculateLoan({
      principal: 10000,
      interestRate: 0.5,
      paymentFrequency: "WEEKLY",
      baseDuration: 9,
      adjustmentPerPeriod: 0.01,
      minRate: 0.5,
      maxRate: 0.4
    });

    const tenWeeks = result.options.find((option) => option.duration === 10);
    expect(tenWeeks?.interestRate).to.equal(0.3);
    expect(tenWeeks?.paymentPerPeriod).to.equal(1300);
    expect(result.minRate).to.equal(0.1);
    expect(result.maxRate).to.equal(0.6);
    expect(result.pricing).to.deep.equal(DEFAULT_LOAN_PRICING);
  });

  it("should price from the injected pricing", async () => {
    const pricing = { ...DEFAULT_LOAN_PRICING, referenceRate: 0.25 };
    const result = await createCalculateLoan(pricing)({
      principal: 10000,
      paymentFrequency: "WEEKLY",
      baseDuration: 10
    });

    expect(result.options.find((option) => option.isBase)?.interestRate).to.equal(0.25);
    expect(result.pricing).to.deep.equal(pricing);
  });

  it("should throw ValidationError for invalid principal", async () => {
    try {
      await calculateLoan({
        principal: -1,
        paymentFrequency: "WEEKLY",
        baseDuration: 10
      });
      expect.fail("Expected ValidationError to be thrown");
    } catch (error) {
      expect(error).to.be.instanceOf(ValidationError);
    }
  });

  it("should round payment per period to multiples of 50", async () => {
    const result = await calculateLoan({
      principal: 5000,
      paymentFrequency: "WEEKLY",
      baseDuration: 9
    });

    result.options.forEach((option) => {
      expect(option.paymentPerPeriod % 50).to.equal(0);
    });
  });

  it("should calculate for BIWEEKLY frequency", async () => {
    const result = await calculateLoan({
      principal: 5000,
      paymentFrequency: "BIWEEKLY",
      baseDuration: 10
    });

    const baseOption = result.options.find((option) => option.isBase);
    expect(baseOption).to.exist;
    expect(baseOption?.duration).to.equal(10);
    expect(baseOption?.paymentFrequency).to.equal("BIWEEKLY");
  });

  it("should calculate for MONTHLY frequency", async () => {
    const result = await calculateLoan({
      principal: 10000,
      paymentFrequency: "MONTHLY",
      baseDuration: 6
    });

    const baseOption = result.options.find((option) => option.isBase);
    expect(baseOption).to.exist;
    expect(baseOption?.duration).to.equal(6);
    expect(baseOption?.paymentFrequency).to.equal("MONTHLY");
  });
});

describe("getLoanPricing", () => {
  const as = (roles: ("ADMIN" | "REVIEWER")[]) =>
    appRouter.createCaller({
      db: {} as never,
      isAuthenticated: true,
      userId: "00000000-0000-4000-8000-000000000001",
      roles
    });

  it("returns the config's loans.pricing to a reviewer and to an admin", async () => {
    for (const roles of [["REVIEWER"], ["ADMIN"]] as const) {
      const pricing = await as([...roles]).getLoanPricing();
      expect(pricing).to.deep.equal(getConfig().loans.pricing);
    }
  });
});
