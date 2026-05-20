/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createCreatePayment } from "../../src/api/payments/createCreatePayment.js";
import {
  ValidationError,
  computeAccruedMora,
  toLoanPaymentData,
  type ResolvedMikroConfig
} from "@mikro/common";

const noMoraGetConfig = (): ResolvedMikroConfig =>
  ({
    loans: {
      defaultMoraRate: 0,
      moraGraceDays: 0,
      moraCapInCuotas: 1,
      moraMinDop: 0,
      moraStopOnDefault: false,
      moraEffectiveFrom: undefined
    }
  }) as unknown as ResolvedMikroConfig;

const paymentTestOpts = { getConfigFn: noMoraGetConfig };

describe("createCreatePayment", () => {
  const validNumericLoanId = 10000;
  const validLoanUuid = "550e8400-e29b-41d4-a716-446655440000";
  const validCollectorId = "660e8400-e29b-41d4-a716-446655440001";
  const validInput = {
    loanId: validNumericLoanId,
    amount: 650,
    collectedById: validCollectorId
  };

  function baseLoan(overrides: Record<string, unknown> = {}) {
    return {
      id: validLoanUuid,
      paymentAmount: 650,
      paymentFrequency: "WEEKLY",
      createdAt: new Date("2026-01-01"),
      startingDate: null,
      termLength: 10,
      status: "ACTIVE" as const,
      updatedAt: new Date(),
      moraRate: null,
      customer: { preferredPaymentDay: null as string | null },
      payments: [] as Array<{
        paidAt: Date;
        status: string;
        kind?: string;
        amount?: number;
      }>,
      ...overrides
    };
  }

  function row(
    id: string,
    overrides: Partial<{
      amount: number;
      status: string;
      kind: string;
      linkedPaymentId: string | null;
      notes: string | null;
      method: string;
    }> = {}
  ) {
    return {
      id,
      loanId: validLoanUuid,
      amount: overrides.amount ?? 650,
      paidAt: new Date(),
      method: overrides.method ?? "CASH",
      status: overrides.status ?? "COMPLETED",
      kind: overrides.kind ?? "INSTALLMENT",
      linkedPaymentId: overrides.linkedPaymentId ?? null,
      notes: overrides.notes ?? null,
      collectedById: validCollectorId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should create a payment with default method CASH", async () => {
      const expected = row("payment-123");
      const mockClient = {
        loan: {
          findUnique: sinon.stub().resolves(baseLoan())
        },
        payment: {
          findMany: sinon.stub().resolves([]),
          create: sinon.stub().resolves(expected)
        },
        $transaction: sinon
          .stub()
          .callsFake(async (fn: (tx: typeof mockClient) => Promise<unknown>) => {
            return fn(mockClient);
          })
      };
      const createPayment = createCreatePayment(
        mockClient as Parameters<typeof createCreatePayment>[0],
        paymentTestOpts
      );

      const result = await createPayment(validInput);

      expect(result.installment?.id).to.equal("payment-123");
      expect(result.lateFee).to.equal(null);
      expect(mockClient.loan.findUnique.calledOnce).to.be.true;
      expect(mockClient.payment.create.calledOnce).to.be.true;
      const createCall = mockClient.payment.create.getCall(0);
      expect(createCall.args[0].data.loanId).to.equal(validLoanUuid);
      expect(createCall.args[0].data.amount).to.equal(650);
      expect(createCall.args[0].data.method).to.equal("CASH");
      expect(createCall.args[0].data.status).to.equal("COMPLETED");
      expect(createCall.args[0].data.kind).to.equal("INSTALLMENT");
      expect(createCall.args[0].data.collectedById).to.equal(validCollectorId);
    });

    it("should create a payment with explicit method TRANSFER", async () => {
      const inputWithMethod = { ...validInput, method: "TRANSFER" as const };
      const expected = row("payment-456", { amount: 650, method: "TRANSFER" });
      const mockClient = {
        loan: { findUnique: sinon.stub().resolves(baseLoan()) },
        payment: { findMany: sinon.stub().resolves([]), create: sinon.stub().resolves(expected) },
        $transaction: sinon
          .stub()
          .callsFake(async (fn: (tx: typeof mockClient) => Promise<unknown>) => fn(mockClient))
      };
      const createPayment = createCreatePayment(
        mockClient as Parameters<typeof createCreatePayment>[0],
        paymentTestOpts
      );
      const result = await createPayment(inputWithMethod);
      expect(result.installment?.method).to.equal("TRANSFER");
    });

    it("should create a payment with all optional fields", async () => {
      const paidAt = new Date("2026-01-15");
      const fullInput = {
        ...validInput,
        paidAt,
        method: "CASH" as const,
        collectedById: validCollectorId,
        notes: "Weekly payment"
      };
      const expected = row("payment-789", { notes: "Weekly payment" });
      const mockClient = {
        loan: { findUnique: sinon.stub().resolves(baseLoan()) },
        payment: { findMany: sinon.stub().resolves([]), create: sinon.stub().resolves(expected) },
        $transaction: sinon
          .stub()
          .callsFake(async (fn: (tx: typeof mockClient) => Promise<unknown>) => fn(mockClient))
      };
      const createPayment = createCreatePayment(
        mockClient as Parameters<typeof createCreatePayment>[0],
        paymentTestOpts
      );
      const result = await createPayment(fullInput);
      expect(result.installment?.notes).to.equal("Weekly payment");
    });

    it("should record PARTIAL when amount is below expected payment", async () => {
      const expected = row("payment-partial", { amount: 300, status: "PARTIAL" });
      const mockClient = {
        loan: { findUnique: sinon.stub().resolves(baseLoan()) },
        payment: { findMany: sinon.stub().resolves([]), create: sinon.stub().resolves(expected) },
        $transaction: sinon
          .stub()
          .callsFake(async (fn: (tx: typeof mockClient) => Promise<unknown>) => fn(mockClient))
      };
      const createPayment = createCreatePayment(
        mockClient as Parameters<typeof createCreatePayment>[0],
        paymentTestOpts
      );
      const result = await createPayment({ ...validInput, amount: 300 });
      expect(result.installment?.status).to.equal("PARTIAL");
      expect(mockClient.payment.create.getCall(0).args[0].data.status).to.equal("PARTIAL");
    });

    it("should allow status override COMPLETED when amount is below expected", async () => {
      const expected = row("payment-override", { amount: 300, status: "COMPLETED" });
      const mockClient = {
        loan: { findUnique: sinon.stub().resolves(baseLoan()) },
        payment: { findMany: sinon.stub().resolves([]), create: sinon.stub().resolves(expected) },
        $transaction: sinon
          .stub()
          .callsFake(async (fn: (tx: typeof mockClient) => Promise<unknown>) => fn(mockClient))
      };
      const createPayment = createCreatePayment(
        mockClient as Parameters<typeof createCreatePayment>[0],
        paymentTestOpts
      );
      await createPayment({ ...validInput, amount: 300, status: "COMPLETED" });
      expect(mockClient.payment.create.getCall(0).args[0].data.status).to.equal("COMPLETED");
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for invalid loanId (not a positive integer)", async () => {
      const mockClient = {
        loan: { findUnique: sinon.stub() },
        payment: { create: sinon.stub() },
        $transaction: sinon.stub()
      };
      const createPayment = createCreatePayment(
        mockClient as Parameters<typeof createCreatePayment>[0],
        paymentTestOpts
      );
      try {
        await createPayment({ ...validInput, loanId: -1 });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.loan.findUnique.called).to.be.false;
      }
    });

    it("should throw error when loan not found", async () => {
      const mockClient = {
        loan: { findUnique: sinon.stub().resolves(null) },
        payment: { findMany: sinon.stub(), create: sinon.stub() },
        $transaction: sinon.stub()
      };
      const createPayment = createCreatePayment(
        mockClient as Parameters<typeof createCreatePayment>[0],
        paymentTestOpts
      );
      try {
        await createPayment(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.include("Loan not found");
        expect(mockClient.payment.create.called).to.be.false;
      }
    });

    it("should throw error when duplicate payment detected within 10 minutes", async () => {
      const recentPayment = {
        id: "recent-payment-123",
        amount: 650,
        paidAt: new Date(),
        createdAt: new Date(Date.now() - 5 * 60 * 1000),
        method: "CASH",
        status: "COMPLETED",
        kind: "INSTALLMENT",
        notes: null,
        loanId: validLoanUuid,
        collectedById: validCollectorId,
        updatedAt: new Date()
      };
      const mockClient = {
        loan: { findUnique: sinon.stub().resolves(baseLoan()) },
        payment: {
          findMany: sinon.stub().resolves([recentPayment]),
          create: sinon.stub()
        },
        $transaction: sinon.stub()
      };
      const createPayment = createCreatePayment(
        mockClient as Parameters<typeof createCreatePayment>[0],
        paymentTestOpts
      );
      try {
        await createPayment(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.include("Duplicate payment blocked");
        expect(mockClient.payment.findMany.calledOnce).to.be.true;
        const findManyCall = mockClient.payment.findMany.getCall(0);
        expect(findManyCall.args[0].where.kind).to.equal("INSTALLMENT");
        expect(mockClient.$transaction.called).to.be.false;
      }
    });

    it("should allow payment when no recent payment exists", async () => {
      const expected = row("payment-123");
      const mockClient = {
        loan: { findUnique: sinon.stub().resolves(baseLoan()) },
        payment: { findMany: sinon.stub().resolves([]), create: sinon.stub().resolves(expected) },
        $transaction: sinon
          .stub()
          .callsFake(async (fn: (tx: typeof mockClient) => Promise<unknown>) => fn(mockClient))
      };
      const createPayment = createCreatePayment(
        mockClient as Parameters<typeof createCreatePayment>[0],
        paymentTestOpts
      );
      const result = await createPayment(validInput);
      expect(result.installment?.id).to.equal("payment-123");
    });

    it("should allow payment when existing payment is older than 10 minutes", async () => {
      const oldPayment = {
        id: "old-payment-123",
        amount: 650,
        paidAt: new Date(),
        createdAt: new Date(Date.now() - 15 * 60 * 1000),
        method: "CASH",
        status: "COMPLETED",
        kind: "INSTALLMENT",
        notes: null,
        loanId: validLoanUuid,
        collectedById: validCollectorId,
        updatedAt: new Date()
      };
      const expected = row("payment-123");
      const mockClient = {
        loan: { findUnique: sinon.stub().resolves(baseLoan()) },
        payment: {
          findMany: sinon.stub().resolves([oldPayment]),
          create: sinon.stub().resolves(expected)
        },
        $transaction: sinon
          .stub()
          .callsFake(async (fn: (tx: typeof mockClient) => Promise<unknown>) => fn(mockClient))
      };
      const createPayment = createCreatePayment(
        mockClient as Parameters<typeof createCreatePayment>[0],
        paymentTestOpts
      );
      const result = await createPayment(validInput);
      expect(result.installment?.id).to.equal("payment-123");
    });

    it("should throw ValidationError for negative amount", async () => {
      const mockClient = { payment: { create: sinon.stub() }, $transaction: sinon.stub() };
      const createPayment = createCreatePayment(
        mockClient as Parameters<typeof createCreatePayment>[0],
        paymentTestOpts
      );
      try {
        await createPayment({ ...validInput, amount: -100 });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
      }
    });

    it("should throw ValidationError for invalid collectedById UUID", async () => {
      const mockClient = { payment: { create: sinon.stub() }, $transaction: sinon.stub() };
      const createPayment = createCreatePayment(
        mockClient as Parameters<typeof createCreatePayment>[0],
        paymentTestOpts
      );
      try {
        await createPayment({ ...validInput, collectedById: "invalid" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
      }
    });
  });

  describe("mora-first split", () => {
    const moraGetConfig = (): ResolvedMikroConfig =>
      ({
        loans: {
          defaultMoraRate: 0.1,
          moraGraceDays: 0,
          moraCapInCuotas: 10,
          moraMinDop: 0,
          moraStopOnDefault: false,
          moraEffectiveFrom: undefined
        }
      }) as unknown as ResolvedMikroConfig;

    const moraOpts = { getConfigFn: moraGetConfig };

    function delinquentLoan() {
      return baseLoan({
        paymentAmount: 650,
        startingDate: new Date("2026-01-01"),
        createdAt: new Date("2026-01-01"),
        status: "ACTIVE",
        payments: []
      });
    }

    it("should split into LATE_FEE + INSTALLMENT when mora is owed", async () => {
      const feeRow = row("fee-1", { kind: "LATE_FEE", amount: 50 });
      const instRow = row("inst-1", { kind: "INSTALLMENT", amount: 600, linkedPaymentId: "fee-1" });
      let callIdx = 0;
      const mockClient = {
        loan: { findUnique: sinon.stub().resolves(delinquentLoan()) },
        payment: {
          findMany: sinon.stub().resolves([]),
          create: sinon.stub().callsFake(async () => {
            callIdx++;
            return callIdx === 1 ? feeRow : instRow;
          })
        },
        $transaction: sinon
          .stub()
          .callsFake(async (fn: (tx: typeof mockClient) => Promise<unknown>) => fn(mockClient))
      };
      const createPayment = createCreatePayment(
        mockClient as Parameters<typeof createCreatePayment>[0],
        moraOpts
      );

      const result = await createPayment({
        ...validInput,
        amount: 700,
        paidAt: new Date("2026-03-01")
      });

      expect(result.lateFee).to.not.be.null;
      expect(result.installment).to.not.be.null;
      expect(mockClient.payment.create.callCount).to.equal(2);
      const firstCall = mockClient.payment.create.getCall(0);
      expect(firstCall.args[0].data.kind).to.equal("LATE_FEE");
      const secondCall = mockClient.payment.create.getCall(1);
      expect(secondCall.args[0].data.kind).to.equal("INSTALLMENT");
      expect(secondCall.args[0].data.linkedPaymentId).to.equal("fee-1");
    });

    it("should create mora-only row when amount is less than accrued mora", async () => {
      const feeRow = row("fee-only", { kind: "LATE_FEE", amount: 10 });
      const mockClient = {
        loan: { findUnique: sinon.stub().resolves(delinquentLoan()) },
        payment: {
          findMany: sinon.stub().resolves([]),
          create: sinon.stub().resolves(feeRow)
        },
        $transaction: sinon
          .stub()
          .callsFake(async (fn: (tx: typeof mockClient) => Promise<unknown>) => fn(mockClient))
      };
      const createPayment = createCreatePayment(
        mockClient as Parameters<typeof createCreatePayment>[0],
        moraOpts
      );

      const result = await createPayment({
        ...validInput,
        amount: 10,
        paidAt: new Date("2026-03-01")
      });

      expect(result.lateFee).to.not.be.null;
      expect(result.installment).to.be.null;
      expect(mockClient.payment.create.calledOnce).to.be.true;
      expect(mockClient.payment.create.getCall(0).args[0].data.kind).to.equal("LATE_FEE");
    });

    it("should apply lateFeeOverride to reduce mora portion", async () => {
      const instRow = row("inst-waived", { kind: "INSTALLMENT", amount: 700 });
      const mockClient = {
        loan: { findUnique: sinon.stub().resolves(delinquentLoan()) },
        payment: {
          findMany: sinon.stub().resolves([]),
          create: sinon.stub().resolves(instRow)
        },
        $transaction: sinon
          .stub()
          .callsFake(async (fn: (tx: typeof mockClient) => Promise<unknown>) => fn(mockClient))
      };
      const createPayment = createCreatePayment(
        mockClient as Parameters<typeof createCreatePayment>[0],
        moraOpts
      );

      const result = await createPayment({
        ...validInput,
        amount: 700,
        paidAt: new Date("2026-03-01"),
        lateFeeOverride: 99999
      });

      expect(result.installment).to.not.be.null;
      expect(result.lateFee).to.be.null;
      expect(mockClient.payment.create.calledOnce).to.be.true;
      expect(mockClient.payment.create.getCall(0).args[0].data.kind).to.equal("INSTALLMENT");
    });

    it("should skip mora when kind=INSTALLMENT is forced on delinquent loan", async () => {
      const instRow = row("forced-inst", { kind: "INSTALLMENT", amount: 650 });
      const mockClient = {
        loan: { findUnique: sinon.stub().resolves(delinquentLoan()) },
        payment: {
          findMany: sinon.stub().resolves([]),
          create: sinon.stub().resolves(instRow)
        },
        $transaction: sinon
          .stub()
          .callsFake(async (fn: (tx: typeof mockClient) => Promise<unknown>) => fn(mockClient))
      };
      const createPayment = createCreatePayment(
        mockClient as Parameters<typeof createCreatePayment>[0],
        moraOpts
      );

      const result = await createPayment({
        ...validInput,
        paidAt: new Date("2026-03-01"),
        kind: "INSTALLMENT"
      });

      expect(result.installment).to.not.be.null;
      expect(result.lateFee).to.be.null;
      expect(mockClient.payment.create.calledOnce).to.be.true;
      expect(mockClient.payment.create.getCall(0).args[0].data.kind).to.equal("INSTALLMENT");
    });

    it("should create single LATE_FEE row when kind=LATE_FEE is forced", async () => {
      const feeRow = row("forced-fee", { kind: "LATE_FEE", amount: 650 });
      const mockClient = {
        loan: { findUnique: sinon.stub().resolves(delinquentLoan()) },
        payment: {
          findMany: sinon.stub().resolves([]),
          create: sinon.stub().resolves(feeRow)
        },
        $transaction: sinon
          .stub()
          .callsFake(async (fn: (tx: typeof mockClient) => Promise<unknown>) => fn(mockClient))
      };
      const createPayment = createCreatePayment(
        mockClient as Parameters<typeof createCreatePayment>[0],
        moraOpts
      );

      const result = await createPayment({
        ...validInput,
        paidAt: new Date("2026-03-01"),
        kind: "LATE_FEE"
      });

      expect(result.lateFee).to.not.be.null;
      expect(result.installment).to.be.null;
      expect(mockClient.payment.create.calledOnce).to.be.true;
      expect(mockClient.payment.create.getCall(0).args[0].data.kind).to.equal("LATE_FEE");
    });

    it("should not re-charge mora on top-up after PARTIAL when LATE_FEE already collected", async () => {
      const paidAt = new Date("2026-03-01T12:00:00Z");
      const loanWithPartial = delinquentLoan();
      const cfg = moraGetConfig().loans;
      const grossMora = computeAccruedMora({
        loanData: toLoanPaymentData(loanWithPartial),
        moraRate: cfg.defaultMoraRate,
        paymentAmount: 650,
        paymentFrequency: "WEEKLY",
        preferredPaymentDay: null,
        loanStart: new Date("2026-01-01"),
        asOfDate: paidAt,
        loanStatus: "ACTIVE",
        policy: cfg
      }).grossMoraAmount;

      loanWithPartial.payments = [
        {
          paidAt,
          status: "COMPLETED",
          kind: "LATE_FEE",
          amount: grossMora
        },
        {
          paidAt,
          status: "PARTIAL",
          kind: "INSTALLMENT",
          amount: 550
        }
      ];

      const instRow = row("topup-inst", {
        kind: "INSTALLMENT",
        amount: 1000,
        status: "COMPLETED"
      });
      const mockClient = {
        loan: { findUnique: sinon.stub().resolves(loanWithPartial) },
        payment: {
          findMany: sinon.stub().resolves([]),
          create: sinon.stub().resolves(instRow)
        },
        $transaction: sinon
          .stub()
          .callsFake(async (fn: (tx: typeof mockClient) => Promise<unknown>) => fn(mockClient))
      };
      const createPayment = createCreatePayment(
        mockClient as Parameters<typeof createCreatePayment>[0],
        moraOpts
      );

      const result = await createPayment({
        ...validInput,
        amount: 1000,
        paidAt
      });

      expect(result.lateFee).to.be.null;
      expect(result.installment).to.not.be.null;
      expect(mockClient.payment.create.calledOnce).to.be.true;
      expect(mockClient.payment.create.getCall(0).args[0].data.kind).to.equal("INSTALLMENT");
      expect(mockClient.payment.create.getCall(0).args[0].data.amount).to.equal(1000);
      expect(mockClient.payment.create.getCall(0).args[0].data.status).to.equal("COMPLETED");
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error from loan lookup", async () => {
      const mockClient = {
        loan: { findUnique: sinon.stub().rejects(new Error("Connection failed")) },
        payment: { create: sinon.stub() },
        $transaction: sinon.stub()
      };
      const createPayment = createCreatePayment(
        mockClient as Parameters<typeof createCreatePayment>[0],
        paymentTestOpts
      );
      try {
        await createPayment(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Connection failed");
      }
    });

    it("should propagate the error from payment creation", async () => {
      const mockClient = {
        loan: { findUnique: sinon.stub().resolves(baseLoan()) },
        payment: {
          findMany: sinon.stub().resolves([]),
          create: sinon.stub().rejects(new Error("Payment creation failed"))
        },
        $transaction: sinon
          .stub()
          .callsFake(async (fn: (tx: typeof mockClient) => Promise<unknown>) => fn(mockClient))
      };
      const createPayment = createCreatePayment(
        mockClient as Parameters<typeof createCreatePayment>[0],
        paymentTestOpts
      );
      try {
        await createPayment(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Payment creation failed");
      }
    });
  });
});
