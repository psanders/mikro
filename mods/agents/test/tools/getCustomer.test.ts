/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { handleGetCustomer } from "../../src/tools/executor/getCustomer.js";
import type { ToolExecutorDependencies } from "../../src/tools/executor/types.js";

function makeDeps(stub: sinon.SinonStub): ToolExecutorDependencies {
  return { getCustomer: stub } as unknown as ToolExecutorDependencies;
}

describe("handleGetCustomer", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("returns the customer on a match", async () => {
    const customer = { id: "cust-1", name: "Elena Ramírez" };
    const getCustomerStub = sinon.stub().resolves(customer);
    const deps = makeDeps(getCustomerStub);

    const result = await handleGetCustomer(deps, { customerId: "cust-1" });

    expect(result.success).to.be.true;
    expect(result.reason).to.be.undefined;
    expect((result.data as { customer: unknown }).customer).to.deep.equal(customer);
  });

  it("reports reason: NOT_FOUND, not just success: false, when no customer matches", async () => {
    const getCustomerStub = sinon.stub().resolves(null);
    const deps = makeDeps(getCustomerStub);

    const result = await handleGetCustomer(deps, { customerId: "does-not-exist" });

    expect(result.success).to.be.false;
    expect(result.reason).to.equal("NOT_FOUND");
    expect(result.message).to.match(/no encontrado/);
  });
});
