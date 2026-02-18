/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { handleCalculateLoan } from "../../src/tools/executor/calculateLoan.js";
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
      interestRate: "0.30",
      paymentFrequency: "WEEKLY",
      baseDuration: "10"
    });

    expect(result.success).to.be.true;
    expect(result.message).to.include("RD$ 5000.00");
    expect(calculateLoanStub.calledOnce).to.be.true;
    expect(
      calculateLoanStub.calledWith({
        principal: 5000,
        interestRate: 0.3,
        paymentFrequency: "WEEKLY",
        baseDuration: 10,
        adjustmentPerPeriod: undefined
      })
    ).to.be.true;
  });

  it("should propagate error when calculateLoan rejects", async () => {
    const calculateLoanStub = sinon.stub().rejects(new Error("Invalid calculation input"));
    const deps = {
      calculateLoan: calculateLoanStub
    } as unknown as ToolExecutorDependencies;

    try {
      await handleCalculateLoan(deps, {
        principal: "5000",
        interestRate: "0.30",
        paymentFrequency: "DAILY",
        baseDuration: "10",
        adjustmentPerPeriod: "0.01"
      });
      expect.fail("Expected handleCalculateLoan to throw");
    } catch (error) {
      expect((error as Error).message).to.equal("Invalid calculation input");
    }
  });
});
