/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createListLoanNotesByLoan } from "../../src/api/loanNotes/createListLoanNotesByLoan.js";
import { ValidationError } from "@mikro/common";

describe("createListLoanNotesByLoan", () => {
  const validLoanUuid = "550e8400-e29b-41d4-a716-446655440000";
  const validInput = { loanId: 10001 };

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should return notes with creator names", async () => {
      const now = new Date();
      const mockNotes = [
        {
          id: "note-1",
          content: "Called, no answer",
          createdAt: now,
          loanId: validLoanUuid,
          createdBy: { name: "Ana López" }
        },
        {
          id: "note-2",
          content: "Left voicemail",
          createdAt: new Date(now.getTime() - 86400000),
          loanId: validLoanUuid,
          createdBy: { name: "Carlos Peña" }
        }
      ];
      const mockClient = {
        loan: { findUnique: sinon.stub().resolves({ id: validLoanUuid }) },
        loanNote: { findMany: sinon.stub().resolves(mockNotes) }
      };
      const listNotes = createListLoanNotesByLoan(mockClient as any);

      const result = await listNotes(validInput);

      expect(result).to.have.lengthOf(2);
      expect(result[0].id).to.equal("note-1");
      expect(result[0].createdBy).to.equal("Ana López");
      expect(result[1].createdBy).to.equal("Carlos Peña");
      expect(mockClient.loanNote.findMany.calledOnce).to.be.true;
      const findCall = mockClient.loanNote.findMany.getCall(0);
      expect(findCall.args[0].where.loanId).to.equal(validLoanUuid);
      expect(findCall.args[0].orderBy.createdAt).to.equal("desc");
    });

    it("should return empty array when loan has no notes", async () => {
      const mockClient = {
        loan: { findUnique: sinon.stub().resolves({ id: validLoanUuid }) },
        loanNote: { findMany: sinon.stub().resolves([]) }
      };
      const listNotes = createListLoanNotesByLoan(mockClient as any);

      const result = await listNotes(validInput);

      expect(result).to.be.an("array").with.lengthOf(0);
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for negative loanId", async () => {
      const mockClient = {
        loan: { findUnique: sinon.stub() },
        loanNote: { findMany: sinon.stub() }
      };
      const listNotes = createListLoanNotesByLoan(mockClient as any);

      try {
        await listNotes({ loanId: -1 });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.loan.findUnique.called).to.be.false;
      }
    });

    it("should throw error when loan not found", async () => {
      const mockClient = {
        loan: { findUnique: sinon.stub().resolves(null) },
        loanNote: { findMany: sinon.stub() }
      };
      const listNotes = createListLoanNotesByLoan(mockClient as any);

      try {
        await listNotes(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.include("Loan not found");
        expect(mockClient.loanNote.findMany.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      const mockClient = {
        loan: { findUnique: sinon.stub().resolves({ id: validLoanUuid }) },
        loanNote: { findMany: sinon.stub().rejects(new Error("Connection failed")) }
      };
      const listNotes = createListLoanNotesByLoan(mockClient as any);

      try {
        await listNotes(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Connection failed");
      }
    });
  });
});
