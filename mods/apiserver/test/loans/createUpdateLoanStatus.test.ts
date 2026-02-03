/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createUpdateLoanStatus } from "../../src/api/loans/createUpdateLoanStatus.js";
import { ValidationError } from "@mikro/common";

describe("createUpdateLoanStatus", () => {
  const validInput = { loanId: 10000, status: "COMPLETED" as const };

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should update loan status and return id, loanId, status", async () => {
      const existingLoan = { id: "loan-uuid-1", loanId: 10000 };
      const updatedLoan = {
        id: "loan-uuid-1",
        loanId: 10000,
        status: "COMPLETED"
      };
      const mockClient = {
        loan: {
          findUnique: sinon.stub().resolves(existingLoan),
          update: sinon.stub().resolves(updatedLoan)
        }
      };
      const updateLoanStatus = createUpdateLoanStatus(mockClient as any);

      const result = await updateLoanStatus(validInput);

      expect(result.id).to.equal("loan-uuid-1");
      expect(result.loanId).to.equal(10000);
      expect(result.status).to.equal("COMPLETED");
      expect(mockClient.loan.findUnique.calledOnce).to.be.true;
      expect(
        mockClient.loan.findUnique.calledWith({
          where: { loanId: 10000 },
          select: { id: true, loanId: true }
        })
      ).to.be.true;
      expect(mockClient.loan.update.calledOnce).to.be.true;
      expect(
        mockClient.loan.update.calledWith({
          where: { id: "loan-uuid-1" },
          data: { status: "COMPLETED" },
          select: { id: true, loanId: true, status: true }
        })
      ).to.be.true;
    });

    it("should accept DEFAULTED and CANCELLED status", async () => {
      const existingLoan = { id: "loan-uuid-2", loanId: 10001 };
      const mockClient = {
        loan: {
          findUnique: sinon.stub().resolves(existingLoan),
          update: sinon.stub().callsFake((args: { data: { status: string } }) =>
            Promise.resolve({
              id: existingLoan.id,
              loanId: existingLoan.loanId,
              status: args.data.status
            })
          )
        }
      };
      const updateLoanStatus = createUpdateLoanStatus(mockClient as any);

      const defaulted = await updateLoanStatus({ loanId: 10001, status: "DEFAULTED" });
      expect(defaulted.status).to.equal("DEFAULTED");

      const cancelled = await updateLoanStatus({ loanId: 10001, status: "CANCELLED" });
      expect(cancelled.status).to.equal("CANCELLED");
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for invalid status (ACTIVE)", async () => {
      const mockClient = {
        loan: { findUnique: sinon.stub(), update: sinon.stub() }
      };
      const updateLoanStatus = createUpdateLoanStatus(mockClient as any);

      try {
        await updateLoanStatus({ loanId: 10000, status: "ACTIVE" as any });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.loan.findUnique.called).to.be.false;
        expect(mockClient.loan.update.called).to.be.false;
      }
    });

    it("should throw ValidationError for non-positive loanId", async () => {
      const mockClient = {
        loan: { findUnique: sinon.stub(), update: sinon.stub() }
      };
      const updateLoanStatus = createUpdateLoanStatus(mockClient as any);

      try {
        await updateLoanStatus({ loanId: 0, status: "COMPLETED" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.loan.findUnique.called).to.be.false;
        expect(mockClient.loan.update.called).to.be.false;
      }
    });
  });

  describe("when loan not found", () => {
    it("should throw with message containing loanId", async () => {
      const mockClient = {
        loan: {
          findUnique: sinon.stub().resolves(null),
          update: sinon.stub()
        }
      };
      const updateLoanStatus = createUpdateLoanStatus(mockClient as any);

      try {
        await updateLoanStatus(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.include("10000");
        expect((error as Error).message).to.include("not found");
        expect(mockClient.loan.update.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      const mockClient = {
        loan: {
          findUnique: sinon.stub().resolves({ id: "loan-1", loanId: 10000 }),
          update: sinon.stub().rejects(new Error("Connection failed"))
        }
      };
      const updateLoanStatus = createUpdateLoanStatus(mockClient as any);

      try {
        await updateLoanStatus(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Connection failed");
      }
    });
  });
});
