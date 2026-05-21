/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { handleCreateLoan } from "../../src/tools/executor/createLoan.js";
import type { ToolExecutorDependencies } from "../../src/tools/executor/types.js";

const VALID_CUSTOMER_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeDeps(stub: sinon.SinonStub): ToolExecutorDependencies {
  return { createLoan: stub } as unknown as ToolExecutorDependencies;
}

describe("handleCreateLoan", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("forwards a valid startingDate as a Date instance", async () => {
    const createLoanStub = sinon.stub().resolves({ id: "loan-1", loanId: 10042 });
    const deps = makeDeps(createLoanStub);

    const result = await handleCreateLoan(deps, {
      customerId: VALID_CUSTOMER_ID,
      principal: "5000",
      termLength: "10",
      paymentAmount: "650",
      paymentFrequency: "WEEKLY",
      startingDate: "2026-04-15"
    });

    expect(result.success).to.be.true;
    expect(createLoanStub.calledOnce).to.be.true;
    const call = createLoanStub.firstCall.args[0] as { startingDate?: Date };
    expect(call.startingDate).to.be.instanceOf(Date);
    expect(call.startingDate?.toISOString().slice(0, 10)).to.equal("2026-04-15");
  });

  it("treats omitted startingDate as undefined", async () => {
    const createLoanStub = sinon.stub().resolves({ id: "loan-2", loanId: 10043 });
    const deps = makeDeps(createLoanStub);

    const result = await handleCreateLoan(deps, {
      customerId: VALID_CUSTOMER_ID,
      principal: "5000",
      termLength: "10",
      paymentAmount: "650",
      paymentFrequency: "WEEKLY"
    });

    expect(result.success).to.be.true;
    const call = createLoanStub.firstCall.args[0] as { startingDate?: Date };
    expect(call.startingDate).to.equal(undefined);
  });

  it("refuses an unparseable startingDate (no silent epoch coercion)", async () => {
    const createLoanStub = sinon.stub();
    const deps = makeDeps(createLoanStub);

    const result = await handleCreateLoan(deps, {
      customerId: VALID_CUSTOMER_ID,
      principal: "5000",
      termLength: "10",
      paymentAmount: "650",
      paymentFrequency: "WEEKLY",
      startingDate: "mañana"
    });

    expect(result.success).to.be.false;
    expect(result.message).to.match(/Fecha de inicio inválida/);
    expect(createLoanStub.called).to.be.false;
  });

  it("refuses an empty-string startingDate without calling createLoan", async () => {
    const createLoanStub = sinon.stub().resolves({ id: "loan-3", loanId: 10044 });
    const deps = makeDeps(createLoanStub);

    const result = await handleCreateLoan(deps, {
      customerId: VALID_CUSTOMER_ID,
      principal: "5000",
      termLength: "10",
      paymentAmount: "650",
      paymentFrequency: "WEEKLY",
      startingDate: ""
    });

    expect(result.success).to.be.true;
    const call = createLoanStub.firstCall.args[0] as { startingDate?: Date };
    expect(call.startingDate).to.equal(undefined);
  });
});
