/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { ValidationError } from "@mikro/common";
import { createCalculateLoan } from "../../src/api/loans/createCalculateLoan.js";

describe("createCalculateLoan", () => {
  const calculateLoan = createCalculateLoan();

  it("should calculate base option correctly for 5000 at 30% for 10 weekly periods", async () => {
    const result = await calculateLoan({
      principal: 5000,
      interestRate: 0.3,
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
  });

  it("should decrease interest for shorter durations and increase for longer durations", async () => {
    const result = await calculateLoan({
      principal: 5000,
      interestRate: 0.3,
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

  it("should use custom adjustmentPerPeriod when provided", async () => {
    const result = await calculateLoan({
      principal: 5000,
      interestRate: 0.3,
      paymentFrequency: "DAILY",
      baseDuration: 10,
      adjustmentPerPeriod: 0.01
    });

    const elevenPeriods = result.options.find((option) => option.duration === 11);
    expect(elevenPeriods).to.exist;
    expect(elevenPeriods?.interestRate).to.equal(0.31);
  });

  it("should throw ValidationError for invalid principal", async () => {
    try {
      await calculateLoan({
        principal: -1,
        interestRate: 0.3,
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
      interestRate: 0.3,
      paymentFrequency: "WEEKLY",
      baseDuration: 9
    });

    result.options.forEach((option) => {
      expect(option.paymentPerPeriod % 50).to.equal(0);
    });
  });

  it("should throw when minRate is greater than maxRate", async () => {
    try {
      await calculateLoan({
        principal: 5000,
        interestRate: 0.3,
        paymentFrequency: "WEEKLY",
        baseDuration: 10,
        minRate: 0.5,
        maxRate: 0.4
      });
      expect.fail("Expected error to be thrown");
    } catch (error) {
      expect((error as Error).message).to.equal("minRate cannot be greater than maxRate");
    }
  });
});
