/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createGeneratePortfolioMetrics } from "../../src/api/reports/createGeneratePortfolioMetrics.js";
import { ValidationError } from "@mikro/common";

/** Minimal loan shape returned by mocked Prisma findMany */
function loan(overrides: {
  principal?: number;
  status?: string;
  termLength?: number;
  paymentAmount?: number;
  createdAt?: Date;
  payments?: Array<{ amount: number }>;
}) {
  const {
    principal = 5000,
    status = "ACTIVE",
    termLength = 10,
    paymentAmount = 650,
    createdAt = new Date("2026-01-15"),
    payments = []
  } = overrides;
  return {
    principal,
    status,
    termLength,
    paymentAmount,
    createdAt,
    payments
  };
}

describe("createGeneratePortfolioMetrics", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should return portfolio metrics with expected shape", async () => {
      const mockLoans = [
        loan({ principal: 5000, status: "ACTIVE", payments: [{ amount: 650 }, { amount: 650 }] }),
        loan({ principal: 10000, status: "COMPLETED", payments: Array(10).fill({ amount: 1300 }) }),
        loan({ principal: 5000, status: "DEFAULTED" })
      ];
      const mockClient = {
        loan: {
          findMany: sinon.stub().resolves(mockLoans)
        }
      };
      const getMetrics = createGeneratePortfolioMetrics(mockClient as any);

      const result = await getMetrics({});

      expect(mockClient.loan.findMany.calledOnce).to.be.true;
      expect(result.period).to.have.keys("startDate", "endDate");
      expect(result.loansByStatus).to.have.keys("ACTIVE", "COMPLETED", "DEFAULTED", "CANCELLED");
      expect(result.loansBySize).to.have.keys("standard", "larger", "exception");
      expect(result.totalLoans).to.equal(3);
      expect(result.totalPrincipalDop).to.equal(20000);
      expect(result.loansByStatus.ACTIVE.count).to.equal(1);
      expect(result.loansByStatus.COMPLETED.count).to.equal(1);
      expect(result.loansByStatus.DEFAULTED.count).to.equal(1);
      expect(result.defaultRateByCountPct).to.be.a("number");
      expect(result.collectionRatePct).to.be.a("number");
    });

    it("should exclude CANCELLED loans from portfolio totals", async () => {
      const mockLoans = [
        loan({ principal: 5000, status: "ACTIVE" }),
        loan({ principal: 5000, status: "CANCELLED" })
      ];
      const mockClient = {
        loan: { findMany: sinon.stub().resolves(mockLoans) }
      };
      const getMetrics = createGeneratePortfolioMetrics(mockClient as any);

      const result = await getMetrics({
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-02-28")
      });

      expect(result.totalLoans).to.equal(1);
      expect(result.totalPrincipalDop).to.equal(5000);
      expect(result.loansByStatus.ACTIVE.count).to.equal(1);
      expect(result.loansByStatus.CANCELLED.count).to.equal(0);
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for invalid startDate", async () => {
      const mockClient = { loan: { findMany: sinon.stub() } };
      const getMetrics = createGeneratePortfolioMetrics(mockClient as any);

      try {
        await getMetrics({ startDate: "not-a-date" as any });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.loan.findMany.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      const mockClient = {
        loan: {
          findMany: sinon.stub().rejects(new Error("Connection failed"))
        }
      };
      const getMetrics = createGeneratePortfolioMetrics(mockClient as any);

      try {
        await getMetrics({});
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Connection failed");
      }
    });
  });
});
