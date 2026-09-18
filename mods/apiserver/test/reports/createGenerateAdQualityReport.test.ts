/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The ad-quality report (issue #280): applications grouped by the ad that
 * produced them, with the risk-band split and median Mikro Score. The behaviour
 * worth protecting is the reporting judgement — organic kept separate, ads with
 * no applications still listed, drafts kept out of the lead count — not the
 * arithmetic.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createGenerateAdQualityReport } from "../../src/api/reports/createGenerateAdQualityReport.js";

function makeApplication(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "app-1",
    status: "RECEIVED",
    adId: null,
    score: 60,
    riskBand: "MODERATE_RISK",
    createdAt: new Date("2026-09-10T12:00:00Z"),
    ...overrides
  };
}

function makeClient(applications: unknown[], ads: unknown[] = []) {
  return {
    loanApplication: { findMany: sinon.stub().resolves(applications) },
    metaAd: { findMany: sinon.stub().resolves(ads) }
  };
}

const AD = {
  id: "120212",
  name: "MIKRO | Business owner | v2",
  adsetName: "Prospecting",
  campaignName: "MIKRO | Leads",
  firstSeenAt: new Date("2026-09-01T00:00:00Z"),
  lastSeenAt: new Date("2026-09-10T00:00:00Z")
};

describe("createGenerateAdQualityReport", () => {
  afterEach(() => sinon.restore());

  it("groups applications by the ad that produced them, naming each from the catalog", async () => {
    const client = makeClient(
      [
        makeApplication({ id: "a", adId: "120212", score: 31, riskBand: "HIGH_RISK" }),
        makeApplication({ id: "b", adId: "120212", score: 35, riskBand: "VERY_HIGH_RISK" }),
        makeApplication({ id: "c", adId: "120212", score: 39, riskBand: "HIGH_RISK" })
      ],
      [AD]
    );

    const { data } = await createGenerateAdQualityReport(client as never)({});

    expect(data.rows).to.have.length(2); // the ad + the organic bucket
    const row = data.rows[0];
    expect(row?.adId).to.equal("120212");
    expect(row?.adName).to.equal("MIKRO | Business owner | v2");
    expect(row?.leads).to.equal(3);
    expect(row?.highOrVeryHigh).to.equal(3);
    expect(row?.lowOrModerate).to.equal(0);
    expect(row?.medianScore).to.equal(35);
  });

  it("reports organic traffic as its own bucket, never merged into an ad", async () => {
    const client = makeClient(
      [
        makeApplication({ id: "a", adId: "120212", riskBand: "HIGH_RISK", score: 30 }),
        makeApplication({ id: "b", adId: null, riskBand: "LOW_RISK", score: 80 })
      ],
      [AD]
    );

    const { data } = await createGenerateAdQualityReport(client as never)({});

    const organic = data.rows.find((r) => r.adId === null);
    const ad = data.rows.find((r) => r.adId === "120212");
    expect(organic?.leads).to.equal(1);
    expect(organic?.lowOrModerate).to.equal(1);
    expect(ad?.leads).to.equal(1);
    expect(ad?.lowOrModerate).to.equal(0);
  });

  it("sorts the organic bucket last, so the ads being judged read first", async () => {
    const client = makeClient(
      [
        makeApplication({ id: "a", adId: null }),
        makeApplication({ id: "b", adId: null }),
        makeApplication({ id: "c", adId: null }),
        makeApplication({ id: "d", adId: "120212" })
      ],
      [AD]
    );

    const { data } = await createGenerateAdQualityReport(client as never)({});

    // Organic has the most leads and still sorts last: it is context, not a
    // decision anyone can act on.
    expect(data.rows[data.rows.length - 1]?.adId).to.equal(null);
  });

  it("lists an ad that produced no applications — the spend with nothing to show is the finding", async () => {
    const client = makeClient([], [AD]);

    const { data } = await createGenerateAdQualityReport(client as never)({});

    const row = data.rows.find((r) => r.adId === "120212");
    expect(row).to.not.equal(undefined);
    expect(row?.leads).to.equal(0);
    expect(row?.medianScore).to.equal(null); // not 0, which would read as "terrible"
  });

  it("gives an uncatalogued ad id its own row rather than counting it as organic", async () => {
    const client = makeClient([makeApplication({ adId: "999999" })], []);

    const { data } = await createGenerateAdQualityReport(client as never)({});

    const row = data.rows.find((r) => r.adId === "999999");
    expect(row?.leads).to.equal(1);
    expect(row?.adName).to.equal(null);
    expect(data.rows.find((r) => r.adId === null)?.leads).to.equal(0);
  });

  it("counts drafts apart from leads, so an abandoned form does not flatter an ad", async () => {
    const client = makeClient(
      [
        makeApplication({ id: "a", adId: "120212", status: "DRAFT", score: 90 }),
        makeApplication({ id: "b", adId: "120212", status: "RECEIVED", score: 40 })
      ],
      [AD]
    );

    const { data } = await createGenerateAdQualityReport(client as never)({});

    const row = data.rows.find((r) => r.adId === "120212");
    expect(row?.leads).to.equal(1);
    expect(row?.drafts).to.equal(1);
    expect(row?.medianScore).to.equal(40); // the draft's 90 is not counted
  });

  it("counts SIGNED and CONVERTED as approved, so a better outcome is not a worse number", async () => {
    const client = makeClient(
      [
        makeApplication({ id: "a", adId: "120212", status: "APPROVED" }),
        makeApplication({ id: "b", adId: "120212", status: "SIGNED" }),
        makeApplication({ id: "c", adId: "120212", status: "CONVERTED" }),
        makeApplication({ id: "d", adId: "120212", status: "REJECTED" })
      ],
      [AD]
    );

    const { data } = await createGenerateAdQualityReport(client as never)({});

    expect(data.rows.find((r) => r.adId === "120212")?.approved).to.equal(3);
  });

  it("defaults to a trailing 14-day window and queries on it", async () => {
    const client = makeClient([], []);

    const { data } = await createGenerateAdQualityReport(client as never)({});

    const where = client.loanApplication.findMany.firstCall.args[0].where;
    const spanDays =
      (where.createdAt.lte.getTime() - where.createdAt.gte.getTime()) / (24 * 60 * 60 * 1000);
    expect(Math.round(spanDays)).to.equal(14);
    expect(data.since).to.be.a("string");
    expect(data.until).to.be.a("string");
  });

  it("honours an explicit window", async () => {
    const client = makeClient([], []);

    const { data } = await createGenerateAdQualityReport(client as never)({
      since: "2026-09-01",
      until: "2026-09-15"
    } as never);

    expect(data.since).to.equal("2026-09-01");
    expect(data.until).to.equal("2026-09-15");
  });

  it("leaves an unscored lead out of the median but still counts it as a lead", async () => {
    const client = makeClient(
      [
        makeApplication({ id: "a", adId: "120212", score: null, riskBand: null }),
        makeApplication({ id: "b", adId: "120212", score: 70, riskBand: "LOW_RISK" })
      ],
      [AD]
    );

    const { data } = await createGenerateAdQualityReport(client as never)({});

    const row = data.rows.find((r) => r.adId === "120212");
    expect(row?.leads).to.equal(2);
    expect(row?.medianScore).to.equal(70);
    expect(row?.bands.UNSCORED).to.equal(1);
  });

  it("totals the window across every bucket", async () => {
    const client = makeClient(
      [
        makeApplication({ id: "a", adId: "120212", score: 30, riskBand: "HIGH_RISK" }),
        makeApplication({ id: "b", adId: null, score: 70, riskBand: "LOW_RISK" }),
        makeApplication({ id: "c", adId: null, status: "DRAFT", score: 50 })
      ],
      [AD]
    );

    const { data } = await createGenerateAdQualityReport(client as never)({});

    expect(data.totals.leads).to.equal(2);
    expect(data.totals.drafts).to.equal(1);
    expect(data.totals.lowOrModerate).to.equal(1);
    expect(data.totals.highOrVeryHigh).to.equal(1);
    expect(data.totals.medianScore).to.equal(50);
  });
});
