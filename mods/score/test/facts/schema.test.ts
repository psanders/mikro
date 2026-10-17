/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { creditReportPushSchema, normalizeCedula } from "../../src/facts/schema.js";
import { toPcloudFacts } from "../../src/facts/prestamoscloud.js";
import { emptyScrape } from "../fixtures/pcloud-delinquent.js";

const push = {
  source: "PRESTAMOSCLOUD" as const,
  cedula: "037-0022078-7",
  capturedAt: "2026-10-17T13:32:15.000Z",
  portalOrigin: "https://portal.prestamoscloud.com",
  adapterVersion: "3.14.1",
  rawSha256: "a".repeat(64),
  facts: toPcloudFacts(emptyScrape)
};

describe("creditReportPushSchema", () => {
  it("normalizes cédulas", () => {
    expect(normalizeCedula("03700220787")).to.equal("037-0022078-7");
    expect(normalizeCedula("037-0022078-7")).to.equal("037-0022078-7");
    expect(normalizeCedula("12345")).to.equal(null);
  });

  it("accepts a NO DATOS PrestamosCloud push", () => {
    expect(creditReportPushSchema.safeParse(push).success).to.equal(true);
  });

  it("rejects an unformatted cédula", () => {
    expect(creditReportPushSchema.safeParse({ ...push, cedula: "03700220787" }).success).to.equal(
      false
    );
  });

  it("rejects facts of the wrong source", () => {
    expect(creditReportPushSchema.safeParse({ ...push, source: "EQUIFAX" }).success).to.equal(
      false
    );
  });
});
