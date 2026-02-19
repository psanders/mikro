/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createCreateLoanNote } from "../../src/api/loanNotes/createCreateLoanNote.js";
import { ValidationError } from "@mikro/common";

describe("createCreateLoanNote", () => {
  const validLoanUuid = "550e8400-e29b-41d4-a716-446655440000";
  const validUserId = "660e8400-e29b-41d4-a716-446655440001";
  const validInput = {
    loanId: 10001,
    content: "Cliente prometió pagar el viernes",
    createdById: validUserId
  };

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should create a loan note and return it with creator name", async () => {
      const now = new Date();
      const mockClient = {
        loan: {
          findUnique: sinon.stub().resolves({ id: validLoanUuid })
        },
        user: {
          findUnique: sinon.stub().resolves({ id: validUserId, name: "Ana López" })
        },
        loanNote: {
          create: sinon.stub().resolves({
            id: "note-123",
            content: validInput.content,
            createdAt: now,
            loanId: validLoanUuid,
            createdById: validUserId
          })
        }
      };
      const createLoanNote = createCreateLoanNote(mockClient as any);

      const result = await createLoanNote(validInput);

      expect(result.id).to.equal("note-123");
      expect(result.content).to.equal(validInput.content);
      expect(result.createdAt).to.equal(now);
      expect(result.loanId).to.equal(validLoanUuid);
      expect(result.createdBy).to.equal("Ana López");
      expect(mockClient.loan.findUnique.calledOnce).to.be.true;
      expect(
        mockClient.loan.findUnique.calledWith({
          where: { loanId: validInput.loanId },
          select: { id: true }
        })
      ).to.be.true;
      expect(mockClient.loanNote.create.calledOnce).to.be.true;
      const createCall = mockClient.loanNote.create.getCall(0);
      expect(createCall.args[0].data.content).to.equal(validInput.content);
      expect(createCall.args[0].data.loanId).to.equal(validLoanUuid);
      expect(createCall.args[0].data.createdById).to.equal(validUserId);
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for negative loanId", async () => {
      const mockClient = {
        loan: { findUnique: sinon.stub() },
        user: { findUnique: sinon.stub() },
        loanNote: { create: sinon.stub() }
      };
      const createLoanNote = createCreateLoanNote(mockClient as any);

      try {
        await createLoanNote({ ...validInput, loanId: -1 });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.loan.findUnique.called).to.be.false;
        expect(mockClient.loanNote.create.called).to.be.false;
      }
    });

    it("should throw ValidationError for empty content", async () => {
      const mockClient = {
        loan: { findUnique: sinon.stub() },
        user: { findUnique: sinon.stub() },
        loanNote: { create: sinon.stub() }
      };
      const createLoanNote = createCreateLoanNote(mockClient as any);

      try {
        await createLoanNote({ ...validInput, content: "" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.loanNote.create.called).to.be.false;
      }
    });

    it("should throw ValidationError for invalid createdById UUID", async () => {
      const mockClient = {
        loan: { findUnique: sinon.stub() },
        user: { findUnique: sinon.stub() },
        loanNote: { create: sinon.stub() }
      };
      const createLoanNote = createCreateLoanNote(mockClient as any);

      try {
        await createLoanNote({ ...validInput, createdById: "not-a-uuid" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.loanNote.create.called).to.be.false;
      }
    });

    it("should throw error when loan not found", async () => {
      const mockClient = {
        loan: { findUnique: sinon.stub().resolves(null) },
        user: { findUnique: sinon.stub() },
        loanNote: { create: sinon.stub() }
      };
      const createLoanNote = createCreateLoanNote(mockClient as any);

      try {
        await createLoanNote(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.include("Loan not found");
        expect(mockClient.loanNote.create.called).to.be.false;
      }
    });

    it("should throw error when user not found", async () => {
      const mockClient = {
        loan: { findUnique: sinon.stub().resolves({ id: validLoanUuid }) },
        user: { findUnique: sinon.stub().resolves(null) },
        loanNote: { create: sinon.stub() }
      };
      const createLoanNote = createCreateLoanNote(mockClient as any);

      try {
        await createLoanNote(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.include("User not found");
        expect(mockClient.loanNote.create.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate error from loan lookup", async () => {
      const mockClient = {
        loan: { findUnique: sinon.stub().rejects(new Error("Connection failed")) },
        user: { findUnique: sinon.stub() },
        loanNote: { create: sinon.stub() }
      };
      const createLoanNote = createCreateLoanNote(mockClient as any);

      try {
        await createLoanNote(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Connection failed");
        expect(mockClient.loanNote.create.called).to.be.false;
      }
    });

    it("should propagate error from note creation", async () => {
      const mockClient = {
        loan: { findUnique: sinon.stub().resolves({ id: validLoanUuid }) },
        user: { findUnique: sinon.stub().resolves({ id: validUserId, name: "Ana" }) },
        loanNote: { create: sinon.stub().rejects(new Error("Write failed")) }
      };
      const createLoanNote = createCreateLoanNote(mockClient as any);

      try {
        await createLoanNote(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Write failed");
      }
    });
  });
});
