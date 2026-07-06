/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { handleGetCustomerByPhone } from "../../src/tools/executor/getCustomerByPhone.js";
import type { ToolExecutorDependencies } from "../../src/tools/executor/types.js";

function makeDeps(stub: sinon.SinonStub): ToolExecutorDependencies {
  return { getCustomerByPhone: stub } as unknown as ToolExecutorDependencies;
}

describe("handleGetCustomerByPhone", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("returns the customer on a match", async () => {
    const customer = { id: "cust-1", name: "Elena Ramírez", phone: "+18095551234" };
    const getCustomerByPhoneStub = sinon.stub().resolves(customer);
    const deps = makeDeps(getCustomerByPhoneStub);

    const result = await handleGetCustomerByPhone(deps, { phone: "+18095551234" });

    expect(result.success).to.be.true;
    expect(result.reason).to.be.undefined;
    expect((result.data as { customer: unknown }).customer).to.deep.equal(customer);
  });

  it("reports reason: NOT_FOUND, not just success: false, when no customer matches", async () => {
    const getCustomerByPhoneStub = sinon.stub().resolves(null);
    const deps = makeDeps(getCustomerByPhoneStub);

    const result = await handleGetCustomerByPhone(deps, { phone: "+18095559999" });

    expect(result.success).to.be.false;
    expect(result.reason).to.equal("NOT_FOUND");
    expect(result.message).to.match(/no encontrado/);
  });
});
