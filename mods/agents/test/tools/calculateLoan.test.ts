/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { handleCalculateLoan } from "../../src/tools/executor/calculateLoan.js";
import { calculateLoanTool } from "../../src/tools/definitions.js";
import type { ToolExecutorDependencies } from "../../src/tools/executor/types.js";

describe("handleCalculateLoan", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("should call calculateLoan with normalized numbers and return success", async () => {
    const calculateLoanStub = sinon.stub().resolves({
      principal: 5000,
      paymentFrequency: "WEEKLY",
      baseDuration: 10,
      baseInterestRate: 0.3,
      adjustmentPerPeriod: 0.015,
      minRate: 0.1,
      maxRate: 0.6,
      options: [
        {
          duration: 10,
          paymentFrequency: "WEEKLY",
          interestRate: 0.3,
          totalInterest: 1500,
          totalRepay: 6500,
          paymentPerPeriod: 650,
          isBase: true
        }
      ]
    });
    const deps = {
      calculateLoan: calculateLoanStub
    } as unknown as ToolExecutorDependencies;

    const result = await handleCalculateLoan(deps, {
      principal: "5000",
      paymentFrequency: "WEEKLY",
      baseDuration: "10"
    });

    expect(result.success).to.be.true;
    expect(result.message).to.include("RD$ 5000.00");
    expect(calculateLoanStub.calledOnce).to.be.true;
    expect(calculateLoanStub.firstCall.args[0]).to.deep.equal({
      principal: 5000,
      paymentFrequency: "WEEKLY",
      baseDuration: 10
    });
  });

  it("should not forward a rate or adjustment the model sends anyway", async () => {
    const calculateLoanStub = sinon.stub().resolves({
      principal: 5000,
      paymentFrequency: "WEEKLY",
      baseDuration: 10,
      baseInterestRate: 0.3,
      adjustmentPerPeriod: 0.015,
      minRate: 0.1,
      maxRate: 0.6,
      options: []
    });
    const deps = {
      calculateLoan: calculateLoanStub
    } as unknown as ToolExecutorDependencies;

    await handleCalculateLoan(deps, {
      principal: "5000",
      interestRate: "0.50",
      adjustmentPerPeriod: "0.01",
      paymentFrequency: "WEEKLY",
      baseDuration: "10"
    });

    expect(calculateLoanStub.firstCall.args[0]).to.not.have.any.keys(
      "interestRate",
      "adjustmentPerPeriod"
    );
  });

  it("should define principal, paymentFrequency and baseDuration only, all required", () => {
    const { parameters } = calculateLoanTool.function;
    expect(Object.keys(parameters.properties)).to.deep.equal([
      "principal",
      "paymentFrequency",
      "baseDuration"
    ]);
    expect(parameters.required).to.deep.equal(["principal", "paymentFrequency", "baseDuration"]);
  });

  it("should handle BIWEEKLY frequency argument", async () => {
    const calculateLoanStub = sinon.stub().resolves({
      principal: 5000,
      paymentFrequency: "BIWEEKLY",
      baseDuration: 10,
      baseInterestRate: 0.3,
      adjustmentPerPeriod: 0.015,
      minRate: 0.1,
      maxRate: 0.6,
      options: [
        {
          duration: 10,
          paymentFrequency: "BIWEEKLY",
          interestRate: 0.3,
          totalInterest: 1500,
          totalRepay: 6500,
          paymentPerPeriod: 650,
          isBase: true
        }
      ]
    });
    const deps = {
      calculateLoan: calculateLoanStub
    } as unknown as ToolExecutorDependencies;

    const result = await handleCalculateLoan(deps, {
      principal: "5000",
      paymentFrequency: "BIWEEKLY",
      baseDuration: "10"
    });

    expect(result.success).to.be.true;
    expect(calculateLoanStub.calledWith(sinon.match({ paymentFrequency: "BIWEEKLY" }))).to.be.true;
  });

  it("should handle MONTHLY frequency argument", async () => {
    const calculateLoanStub = sinon.stub().resolves({
      principal: 10000,
      paymentFrequency: "MONTHLY",
      baseDuration: 6,
      baseInterestRate: 0.3,
      adjustmentPerPeriod: 0.015,
      minRate: 0.1,
      maxRate: 0.6,
      options: [
        {
          duration: 6,
          paymentFrequency: "MONTHLY",
          interestRate: 0.3,
          totalInterest: 3000,
          totalRepay: 13000,
          paymentPerPeriod: 2200,
          isBase: true
        }
      ]
    });
    const deps = {
      calculateLoan: calculateLoanStub
    } as unknown as ToolExecutorDependencies;

    const result = await handleCalculateLoan(deps, {
      principal: "10000",
      paymentFrequency: "MONTHLY",
      baseDuration: "6"
    });

    expect(result.success).to.be.true;
    expect(calculateLoanStub.calledWith(sinon.match({ paymentFrequency: "MONTHLY" }))).to.be.true;
  });

  it("should propagate error when calculateLoan rejects", async () => {
    const calculateLoanStub = sinon.stub().rejects(new Error("Invalid calculation input"));
    const deps = {
      calculateLoan: calculateLoanStub
    } as unknown as ToolExecutorDependencies;

    try {
      await handleCalculateLoan(deps, {
        principal: "5000",
        paymentFrequency: "DAILY",
        baseDuration: "10"
      });
      expect.fail("Expected handleCalculateLoan to throw");
    } catch (error) {
      expect((error as Error).message).to.equal("Invalid calculation input");
    }
  });
});
