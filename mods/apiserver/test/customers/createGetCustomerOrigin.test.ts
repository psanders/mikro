/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { ValidationError } from "@mikro/common";
import { createGetCustomerOrigin } from "../../src/api/customers/createGetCustomerOrigin.js";

const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111";

function makeClient(app: unknown) {
  return { loanApplication: { findFirst: sinon.stub().resolves(app) } };
}

describe("createGetCustomerOrigin", () => {
  afterEach(() => sinon.restore());

  it("returns the origin of the customer's converted application", async () => {
    const client = makeClient({ source: "FORM", adId: "120", createdAt: new Date("2026-10-01") });
    const result = await createGetCustomerOrigin(client as any)({ id: CUSTOMER_ID });
    expect(result).to.deep.equal({ origin: "ad" });
  });

  it("uses the most recent converted application", async () => {
    const client = makeClient({ source: "WHATSAPP", adId: null, createdAt: new Date() });
    await createGetCustomerOrigin(client as any)({ id: CUSTOMER_ID });
    const args = client.loanApplication.findFirst.firstCall.args[0];
    expect(args.where).to.deep.equal({ customerId: CUSTOMER_ID, status: "CONVERTED" });
    expect(args.orderBy).to.deep.equal({ createdAt: "desc" });
  });

  it("returns null when no converted application links to the customer", async () => {
    const client = makeClient(null);
    const result = await createGetCustomerOrigin(client as any)({ id: CUSTOMER_ID });
    expect(result).to.deep.equal({ origin: null });
  });

  it("rejects an invalid id and never queries", async () => {
    const client = makeClient(null);
    try {
      await createGetCustomerOrigin(client as any)({ id: "" } as any);
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).to.be.instanceOf(ValidationError);
    }
    expect(client.loanApplication.findFirst.called).to.be.false;
  });
});
