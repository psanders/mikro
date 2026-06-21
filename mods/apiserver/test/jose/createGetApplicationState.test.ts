/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * getApplicationState must return missingFields in priority order so José's
 * very first question targets the highest-weight / knockout fields.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createGetApplicationState } from "../../src/api/jose/createGetApplicationState.js";

const CTX = { sessionId: "sess-jose-1", phone: "+18095550000" };

describe("createGetApplicationState", () => {
  afterEach(() => sinon.restore());

  it("returns missingFields ordered by priority for a fresh application", async () => {
    const findFirst = sinon.stub().resolves({
      sessionId: CTX.sessionId,
      firstName: null,
      lastName: null,
      phone: null,
      idNumber: null,
      dateOfBirth: null,
      maritalStatus: null,
      businessType: null,
      businessName: null,
      requestedAmount: null,
      purpose: null,
      requestedTermWeeks: null,
      province: null,
      homeAddress: null,
      rawData: {}
    });
    const tool = createGetApplicationState({ loanApplication: { findFirst } } as any);

    const result = await tool(CTX);

    expect(result.success).to.be.true;
    const missing = result.data!.missingFields as string[];
    expect(missing[0]).to.equal("province");
    expect(missing[1]).to.equal("businessType");
    expect(missing.indexOf("monthlySales")).to.be.lessThan(missing.indexOf("referenceName"));
  });
});
