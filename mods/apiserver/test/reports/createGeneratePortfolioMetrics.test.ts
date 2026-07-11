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
  payments?: Array<{ amount: number; status?: string }>;
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
    payments: payments.map((p) => ({
      amount: p.amount,
      status: p.status ?? "COMPLETED"
    }))
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

    it("should include PARTIAL payments in totalCollectedDop but not in paymentsMade", async () => {
      const mockLoans = [
        loan({
          principal: 5000,
          status: "ACTIVE",
          payments: [
            { amount: 650, status: "COMPLETED" },
            { amount: 550, status: "PARTIAL" }
          ]
        })
      ];
      const mockClient = {
        loan: { findMany: sinon.stub().resolves(mockLoans) }
      };
      const getMetrics = createGeneratePortfolioMetrics(mockClient as any);

      const result = await getMetrics({
        endDate: new Date("2026-06-01")
      });

      expect(result.totalCollectedDop).to.equal(1200);
    });

    it("should scope loan.findMany by createdAt using the provided startDate/endDate (issue #200)", async () => {
      const startDate = new Date("2026-01-01");
      const endDate = new Date("2026-02-28");
      const mockClient = {
        loan: { findMany: sinon.stub().resolves([]) }
      };
      const getMetrics = createGeneratePortfolioMetrics(mockClient as any);

      await getMetrics({ startDate, endDate });

      expect(mockClient.loan.findMany.calledOnce).to.be.true;
      const args = mockClient.loan.findMany.firstCall.args[0];
      expect(args.where).to.exist;
      expect(args.where.createdAt.gte.getTime()).to.equal(startDate.getTime());
      const expectedEndOfDay = new Date(endDate);
      expectedEndOfDay.setHours(23, 59, 59, 999);
      expect(args.where.createdAt.lte.getTime()).to.equal(expectedEndOfDay.getTime());
      // Sanity: end-of-day clamp actually moved the time forward.
      expect(args.where.createdAt.lte.getTime()).to.be.greaterThan(endDate.getTime());
    });

    it("should default loan.findMany createdAt filter to year-to-date start and today's end-of-day", async () => {
      const clock = sinon.useFakeTimers(new Date("2026-07-11T15:30:00.000Z").getTime());
      try {
        const mockClient = {
          loan: { findMany: sinon.stub().resolves([]) }
        };
        const getMetrics = createGeneratePortfolioMetrics(mockClient as any);

        await getMetrics({});

        expect(mockClient.loan.findMany.calledOnce).to.be.true;
        const args = mockClient.loan.findMany.firstCall.args[0];
        const now = new Date();
        const expectedStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        const expectedEndOfDay = new Date(now);
        expectedEndOfDay.setHours(23, 59, 59, 999);

        expect(args.where.createdAt.gte.getTime()).to.equal(expectedStart.getTime());
        expect(args.where.createdAt.lte.getTime()).to.equal(expectedEndOfDay.getTime());
      } finally {
        clock.restore();
      }
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
