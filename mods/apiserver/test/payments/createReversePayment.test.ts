/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createReversePayment } from "../../src/api/payments/createReversePayment.js";
import { ValidationError } from "@mikro/common";

describe("createReversePayment", () => {
  const validPaymentId = "550e8400-e29b-41d4-a716-446655440000";
  const feeId = "660e8400-e29b-41d4-a716-446655440001";
  const validInput = { id: validPaymentId };

  afterEach(() => {
    sinon.restore();
  });

  function baseRow(
    id: string,
    overrides: Partial<{
      kind: string;
      linkedPaymentId: string | null;
      linkedLateFee: unknown;
      installmentForLateFee: unknown;
      notes: string | null;
      status: string;
    }> = {}
  ) {
    return {
      id,
      loanId: "loan-123",
      amount: 650,
      paidAt: new Date(),
      method: "CASH",
      status: overrides.status ?? "COMPLETED",
      kind: overrides.kind ?? "INSTALLMENT",
      linkedPaymentId: overrides.linkedPaymentId ?? null,
      linkedLateFee: overrides.linkedLateFee ?? null,
      installmentForLateFee: overrides.installmentForLateFee ?? null,
      notes: overrides.notes ?? null,
      collectedById: "user-1",
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  it("should reverse a standalone INSTALLMENT (single update)", async () => {
    const existing = baseRow(validPaymentId);
    const reversed = { ...existing, status: "REVERSED" };
    const mockTx = {
      payment: {
        update: sinon.stub().resolves(reversed),
        findUnique: sinon.stub().resolves(reversed)
      }
    };
    const mockClient = {
      payment: {
        findUnique: sinon.stub().resolves(existing)
      },
      $transaction: sinon
        .stub()
        .callsFake(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx))
    };
    const reversePayment = createReversePayment(mockClient as any);

    const result = await reversePayment(validInput);

    expect(result.status).to.equal("REVERSED");
    expect(mockClient.payment.findUnique.calledOnce).to.be.true;
    expect(mockClient.$transaction.calledOnce).to.be.true;
    expect(mockTx.payment.update.calledOnce).to.be.true;
    expect(
      mockTx.payment.update.calledWith(
        sinon.match({
          where: { id: validPaymentId },
          data: { status: "REVERSED", notes: undefined }
        })
      )
    ).to.be.true;
  });

  it("should reverse INSTALLMENT and linked LATE_FEE in one transaction", async () => {
    const lateFee = baseRow(feeId, { kind: "LATE_FEE", status: "COMPLETED" });
    const existing = baseRow(validPaymentId, {
      linkedPaymentId: feeId,
      linkedLateFee: lateFee
    });
    const reversed = { ...existing, status: "REVERSED" };
    const mockTx = {
      payment: {
        update: sinon.stub().resolves(reversed),
        findUnique: sinon.stub().resolves(reversed)
      }
    };
    const mockClient = {
      payment: { findUnique: sinon.stub().resolves(existing) },
      $transaction: sinon
        .stub()
        .callsFake(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx))
    };
    const reversePayment = createReversePayment(mockClient as any);

    await reversePayment({ id: validPaymentId, notes: "Refund" });

    expect(mockTx.payment.update.callCount).to.equal(2);
    const ids = mockTx.payment.update
      .getCalls()
      .map((c) => (c.args[0] as { where: { id: string } }).where.id);
    expect(ids.sort()).to.deep.equal([feeId, validPaymentId].sort());
    expect(
      mockTx.payment.update.calledWith(
        sinon.match({
          where: { id: validPaymentId },
          data: { status: "REVERSED", notes: "Refund" }
        })
      )
    ).to.be.true;
    expect(
      mockTx.payment.update.calledWith(
        sinon.match({
          where: { id: feeId },
          data: { status: "REVERSED", notes: undefined }
        })
      )
    ).to.be.true;
  });

  it("should reverse LATE_FEE and linked INSTALLMENT when reversing the fee row", async () => {
    const installment = baseRow(validPaymentId, {
      linkedPaymentId: feeId,
      status: "COMPLETED"
    });
    const existing = baseRow(feeId, {
      kind: "LATE_FEE",
      installmentForLateFee: installment
    });
    const reversedFee = { ...existing, status: "REVERSED" };
    const mockTx = {
      payment: {
        update: sinon.stub().resolves(reversedFee),
        findUnique: sinon.stub().resolves(reversedFee)
      }
    };
    const mockClient = {
      payment: { findUnique: sinon.stub().resolves(existing) },
      $transaction: sinon
        .stub()
        .callsFake(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx))
    };
    const reversePayment = createReversePayment(mockClient as any);

    await reversePayment({ id: feeId });

    expect(mockTx.payment.update.callCount).to.equal(2);
  });

  it("should reverse a standalone LATE_FEE (single update, no linked installment)", async () => {
    const existing = baseRow(validPaymentId, { kind: "LATE_FEE" });
    const reversed = { ...existing, status: "REVERSED" };
    const mockTx = {
      payment: {
        update: sinon.stub().resolves(reversed),
        findUnique: sinon.stub().resolves(reversed)
      }
    };
    const mockClient = {
      payment: { findUnique: sinon.stub().resolves(existing) },
      $transaction: sinon
        .stub()
        .callsFake(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx))
    };
    const reversePayment = createReversePayment(mockClient as any);

    const result = await reversePayment(validInput);

    expect(result.status).to.equal("REVERSED");
    expect(mockTx.payment.update.calledOnce).to.be.true;
    expect(
      mockTx.payment.update.calledWith(
        sinon.match({ where: { id: validPaymentId }, data: { status: "REVERSED" } })
      )
    ).to.be.true;
  });

  it("should throw ValidationError for invalid payment ID UUID", async () => {
    const mockClient = {
      payment: { findUnique: sinon.stub() },
      $transaction: sinon.stub()
    };
    const reversePayment = createReversePayment(mockClient as any);

    try {
      await reversePayment({ id: "invalid-uuid" });
      expect.fail("Expected ValidationError");
    } catch (error) {
      expect(error).to.be.instanceOf(ValidationError);
      expect(mockClient.payment.findUnique.called).to.be.false;
    }
  });

  it("should throw ValidationError for missing id", async () => {
    const mockClient = {
      payment: { findUnique: sinon.stub() },
      $transaction: sinon.stub()
    };
    const reversePayment = createReversePayment(mockClient as any);

    try {
      await reversePayment({} as any);
      expect.fail("Expected ValidationError");
    } catch (error) {
      expect(error).to.be.instanceOf(ValidationError);
    }
  });

  it("should propagate errors from the database layer", async () => {
    const mockClient = {
      payment: {
        findUnique: sinon.stub().rejects(new Error("Payment not found"))
      },
      $transaction: sinon.stub()
    };
    const reversePayment = createReversePayment(mockClient as any);

    try {
      await reversePayment(validInput);
      expect.fail("Expected error");
    } catch (error) {
      expect((error as Error).message).to.equal("Payment not found");
    }
  });
});
