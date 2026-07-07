/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { handleListCustomerLoansByPhone } from "../../src/tools/executor/listCustomerLoansByPhone.js";
import type { ToolExecutorDependencies } from "../../src/tools/executor/types.js";

function makeDeps(overrides: Partial<ToolExecutorDependencies>): ToolExecutorDependencies {
  return overrides as unknown as ToolExecutorDependencies;
}

describe("handleListCustomerLoansByPhone", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("resolves the customer by phone then lists their loans", async () => {
    const customer = { id: "cust-1", name: "Elena Ramírez", phone: "+18095551234" };
    const loans = [{ id: "loan-1" }, { id: "loan-2" }];
    const getCustomerByPhoneStub = sinon.stub().resolves(customer);
    const listLoansByCustomerStub = sinon.stub().resolves(loans);
    const deps = makeDeps({
      getCustomerByPhone: getCustomerByPhoneStub,
      listLoansByCustomer: listLoansByCustomerStub
    });

    const result = await handleListCustomerLoansByPhone(deps, { phone: "18095551234" });

    expect(result.success).to.be.true;
    expect(getCustomerByPhoneStub.calledOnceWith({ phone: "+18095551234" })).to.be.true;
    expect(listLoansByCustomerStub.calledOnceWith({ customerId: "cust-1", showAll: false })).to.be
      .true;
    expect((result.data as { customer: unknown; loans: unknown }).customer).to.deep.equal(customer);
    expect((result.data as { customer: unknown; loans: unknown }).loans).to.deep.equal(loans);
    expect(result.message).to.include("2 préstamos");
  });

  it("passes showAll through to listLoansByCustomer", async () => {
    const customer = { id: "cust-1", name: "Elena Ramírez" };
    const getCustomerByPhoneStub = sinon.stub().resolves(customer);
    const listLoansByCustomerStub = sinon.stub().resolves([]);
    const deps = makeDeps({
      getCustomerByPhone: getCustomerByPhoneStub,
      listLoansByCustomer: listLoansByCustomerStub
    });

    await handleListCustomerLoansByPhone(deps, { phone: "+18095551234", showAll: "true" });

    expect(listLoansByCustomerStub.calledOnceWith({ customerId: "cust-1", showAll: true })).to.be
      .true;
  });

  it("returns a not-found message without calling listLoansByCustomer when no customer matches", async () => {
    const getCustomerByPhoneStub = sinon.stub().resolves(null);
    const listLoansByCustomerStub = sinon.stub();
    const deps = makeDeps({
      getCustomerByPhone: getCustomerByPhoneStub,
      listLoansByCustomer: listLoansByCustomerStub
    });

    const result = await handleListCustomerLoansByPhone(deps, { phone: "18095559999" });

    expect(result.success).to.be.false;
    expect(result.message).to.match(/no encontrado/);
    expect(listLoansByCustomerStub.called).to.be.false;
  });
});
