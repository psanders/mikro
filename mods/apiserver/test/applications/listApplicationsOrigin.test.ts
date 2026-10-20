/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { AD_ATTRIBUTION_START, ValidationError } from "@mikro/common";
import { createListApplications } from "../../src/api/applications/createListApplications.js";

function makeClient() {
  return { loanApplication: { findMany: sinon.stub().resolves([]) } };
}

describe("listApplications origin filter", () => {
  afterEach(() => sinon.restore());

  const cases = {
    ad: { source: "FORM", adId: { not: null } },
    organic: { source: "FORM", adId: null, createdAt: { gte: AD_ATTRIBUTION_START } },
    unknown: { source: "FORM", adId: null, createdAt: { lt: AD_ATTRIBUTION_START } },
    whatsapp: { source: "WHATSAPP" },
    manual: { source: "MANUAL" }
  } as const;

  for (const [origin, where] of Object.entries(cases)) {
    it(`filters ${origin} on the server`, async () => {
      const client = makeClient();
      await createListApplications(client as any)({ origin: origin as keyof typeof cases });
      expect(client.loanApplication.findMany.firstCall.args[0].where).to.deep.equal(where);
    });
  }

  it("combines origin with status", async () => {
    const client = makeClient();
    await createListApplications(client as any)({ origin: "ad", status: "RECEIVED", limit: 5 });
    const args = client.loanApplication.findMany.firstCall.args[0];
    expect(args.where).to.deep.equal({ status: "RECEIVED", source: "FORM", adId: { not: null } });
    expect(args.take).to.equal(5);
  });

  it("lists everything with no filters", async () => {
    const client = makeClient();
    await createListApplications(client as any)({});
    expect(client.loanApplication.findMany.firstCall.args[0].where).to.deep.equal({});
  });

  it("rejects an invalid origin and never queries", async () => {
    const client = makeClient();
    try {
      await createListApplications(client as any)({ origin: "facebook" } as any);
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).to.be.instanceOf(ValidationError);
    }
    expect(client.loanApplication.findMany.called).to.be.false;
  });
});
