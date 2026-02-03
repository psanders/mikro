/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { handleUpdateLoanStatus } from "../../src/tools/executor/updateLoanStatus.js";
import type { ToolExecutorDependencies } from "../../src/tools/executor/types.js";

describe("handleUpdateLoanStatus", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("should call updateLoanStatus with coerced loanId and return success", async () => {
    const expectedResult = {
      id: "loan-uuid-1",
      loanId: 10001,
      status: "COMPLETED"
    };
    const updateLoanStatusStub = sinon.stub().resolves(expectedResult);
    const deps = {
      updateLoanStatus: updateLoanStatusStub
    } as unknown as ToolExecutorDependencies;

    const result = await handleUpdateLoanStatus(deps, {
      loanId: "10001",
      status: "COMPLETED"
    });

    expect(result.success).to.be.true;
    expect(result.message).to.include("10001");
    expect(result.message).to.include("COMPLETED");
    expect(result.data).to.deep.equal(expectedResult);
    expect(updateLoanStatusStub.calledOnce).to.be.true;
    expect(updateLoanStatusStub.calledWith({ loanId: 10001, status: "COMPLETED" })).to.be.true;
  });

  it("should propagate error when updateLoanStatus rejects", async () => {
    const updateLoanStatusStub = sinon.stub().rejects(new Error("Loan not found"));
    const deps = {
      updateLoanStatus: updateLoanStatusStub
    } as unknown as ToolExecutorDependencies;

    try {
      await handleUpdateLoanStatus(deps, { loanId: "99999", status: "CANCELLED" });
      expect.fail("Expected handleUpdateLoanStatus to throw");
    } catch (error) {
      expect((error as Error).message).to.equal("Loan not found");
    }
    expect(updateLoanStatusStub.calledWith({ loanId: 99999, status: "CANCELLED" })).to.be.true;
  });
});
