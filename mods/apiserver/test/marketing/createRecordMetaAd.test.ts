/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The local ad catalog (issue #280): where ad NAMES come from, learned from the
 * URL parameters a click carried. It is what lets the ad-quality report print
 * "MIKRO | Business owner | v2" with no live Meta call, list an ad that produced
 * nothing, and keep reporting an ad that has since been deleted in Ads Manager.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createRecordMetaAd } from "../../src/api/marketing/createRecordMetaAd.js";

function makeClient() {
  const upsert = sinon
    .stub()
    .callsFake((args: { create: Record<string, unknown> }) =>
      Promise.resolve({ id: args.create.id, name: args.create.name ?? null })
    );
  return { client: { metaAd: { upsert } } as never, upsert };
}

const ATTRIBUTION = {
  adId: "120212",
  adsetId: "120211",
  campaignId: "120210",
  adName: "MIKRO | Business owner | v2",
  adsetName: "Prospecting",
  campaignName: "MIKRO | Leads"
};

describe("createRecordMetaAd", () => {
  afterEach(() => sinon.restore());

  it("records the ad under its Meta id with the names the click carried", async () => {
    const { client, upsert } = makeClient();

    await createRecordMetaAd(client)(ATTRIBUTION);

    const args = upsert.firstCall.args[0];
    expect(args.where).to.deep.equal({ id: "120212" });
    expect(args.create.name).to.equal("MIKRO | Business owner | v2");
    expect(args.create.campaignName).to.equal("MIKRO | Leads");
  });

  it("refreshes the name on a later visit, so a renamed ad reports under its current name", async () => {
    const { client, upsert } = makeClient();

    await createRecordMetaAd(client)({ ...ATTRIBUTION, adName: "MIKRO | Business owner | v3" });

    expect(upsert.firstCall.args[0].update.name).to.equal("MIKRO | Business owner | v3");
  });

  it("does not blank a known name when a visit arrives with the id alone", async () => {
    const { client, upsert } = makeClient();

    await createRecordMetaAd(client)({
      ...ATTRIBUTION,
      adName: null,
      adsetName: null,
      campaignName: null
    });

    const update = upsert.firstCall.args[0].update;
    expect(update).to.not.have.property("name");
    expect(update).to.not.have.property("campaignName");
    // The ids are still worth refreshing — an ad can be moved between ad sets.
    expect(update.adsetId).to.equal("120211");
  });

  it("does nothing without an ad id — there is no ad to catalogue", async () => {
    const { client, upsert } = makeClient();

    const result = await createRecordMetaAd(client)({
      adId: null,
      adsetId: null,
      campaignId: null,
      adName: null,
      adsetName: null,
      campaignName: null
    });

    expect(result).to.equal(null);
    expect(upsert.called).to.equal(false);
  });
});
