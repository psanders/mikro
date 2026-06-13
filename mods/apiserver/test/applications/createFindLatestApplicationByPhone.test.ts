/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createFindLatestApplicationByPhone } from "../../src/api/applications/createFindLatestApplicationByPhone.js";

describe("createFindLatestApplicationByPhone", () => {
  afterEach(() => sinon.restore());

  it("returns the most-recent application's sessionId for a phone", async () => {
    const findFirst = sinon.stub().resolves({ sessionId: "sess-1", phone: "+18298717987" });
    const find = createFindLatestApplicationByPhone({
      loanApplication: { findFirst }
    } as any);

    const result = await find("+18298717987");

    expect(result).to.deep.equal({ sessionId: "sess-1" });
    const arg = findFirst.firstCall.args[0];
    expect(arg.where).to.deep.equal({ phone: "+18298717987" });
    expect(arg.orderBy).to.deep.equal({ createdAt: "desc" });
  });

  it("returns null when no application exists for the phone", async () => {
    const findFirst = sinon.stub().resolves(null);
    const find = createFindLatestApplicationByPhone({
      loanApplication: { findFirst }
    } as any);

    expect(await find("+18290000000")).to.be.null;
  });
});
