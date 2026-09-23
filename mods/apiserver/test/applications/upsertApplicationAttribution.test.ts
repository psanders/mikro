/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Ad attribution on the write path (issue #280). The load-bearing rule is that
 * an absent attribution means "this submission could not tell us", not
 * "organic" — the form autosaves several times per applicant and only the posts
 * made while the URL parameters were still around carry the ad.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createUpsertApplication } from "../../src/api/applications/createUpsertApplication.js";
import type { NormalizedApplication } from "@mikro/common";

function makeNormalized(overrides: Partial<NormalizedApplication> = {}): NormalizedApplication {
  return {
    sessionId: "sess-1",
    partial: false,
    lastSection: null,
    rawData: {},
    firstName: "Ana",
    lastName: "López",
    phone: "+18298717987",
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
    ...overrides
  };
}

const ATTRIBUTION = {
  adId: "120212",
  adsetId: "120211",
  campaignId: "120210",
  adName: "MIKRO | Business owner | v2",
  adsetName: "Prospecting",
  campaignName: "MIKRO | Leads"
};

function makeClient() {
  const upsert = sinon.stub().resolves({ id: "app-1", status: "RECEIVED", adId: "120212" });
  return { client: { loanApplication: { upsert, findFirst: async () => null } } as never, upsert };
}

describe("createUpsertApplication — ad attribution", () => {
  afterEach(() => sinon.restore());

  it("stores the ad ids on the application", async () => {
    const { client, upsert } = makeClient();

    await createUpsertApplication(client)(makeNormalized({ attribution: ATTRIBUTION }));

    const data = upsert.firstCall.args[0].update;
    expect(data.adId).to.equal("120212");
    expect(data.adsetId).to.equal("120211");
    expect(data.campaignId).to.equal("120210");
  });

  it("does not write the ad NAMES onto the application — those belong to the catalog", async () => {
    const { client, upsert } = makeClient();

    await createUpsertApplication(client)(makeNormalized({ attribution: ATTRIBUTION }));

    const data = upsert.firstCall.args[0].update;
    expect(data).to.not.have.property("adName");
    expect(data).to.not.have.property("campaignName");
  });

  it("omits the ad columns entirely when a submission carries no attribution", async () => {
    const { client, upsert } = makeClient();

    await createUpsertApplication(client)(makeNormalized());

    // Not `adId: null`: an autosave sent after the applicant navigated away from
    // the landing URL would otherwise erase the ad an earlier post recorded.
    const data = upsert.firstCall.args[0].update;
    expect(data).to.not.have.property("adId");
    expect(data).to.not.have.property("adsetId");
    expect(data).to.not.have.property("campaignId");
  });

  it("records the ad in the catalog so the report can name it later", async () => {
    const { client } = makeClient();
    const recordMetaAd = sinon.stub().resolves();

    await createUpsertApplication(client, { recordMetaAd })(
      makeNormalized({ attribution: ATTRIBUTION })
    );

    expect(recordMetaAd.calledOnceWith(ATTRIBUTION)).to.equal(true);
  });

  it("does not touch the catalog for an organic submission", async () => {
    const { client } = makeClient();
    const recordMetaAd = sinon.stub().resolves();

    await createUpsertApplication(client, { recordMetaAd })(makeNormalized());

    expect(recordMetaAd.called).to.equal(false);
  });

  it("still returns the application when cataloguing the ad fails", async () => {
    const { client } = makeClient();
    const recordMetaAd = sinon.stub().rejects(new Error("db is down"));

    const application = await createUpsertApplication(client, { recordMetaAd })(
      makeNormalized({ attribution: ATTRIBUTION })
    );

    // Writing down what an ad is called is reporting metadata. An applicant's
    // submission must never fail on it.
    expect(application.id).to.equal("app-1");
  });
});
