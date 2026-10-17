/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { REPORT_URL, findReportData } from "../../src/browser/equifax.js";

const API = "https://api.latam.equifax.com/ar-interactive-reports-B2B/v2/countries/DO";

describe("REPORT_URL", () => {
  it("matches the new-report POST and the saved-report GET from the history", () => {
    expect(REPORT_URL.test(`${API}/products/DATACREDITO/reports`)).to.be.true;
    expect(REPORT_URL.test(`${API}/reports/568414327-DATACREDITO-202610131-v2`)).to.be.true;
    expect(REPORT_URL.test(`${API}/reports?lastEventId=&r=1708546267189428`)).to.be.true;
  });

  it("ignores unrelated API calls", () => {
    expect(REPORT_URL.test(`${API}/photo/00000000000`)).to.be.false;
    expect(REPORT_URL.test(`${API}/products`)).to.be.false;
    expect(REPORT_URL.test("https://interactivereports.equifax.com/ir/report")).to.be.false;
  });
});

describe("findReportData", () => {
  const blocks = { bloque_actividadcred: {}, bloque_consul: {} };

  it("finds the credit blocks at the top level, under data, or nested deeper", () => {
    expect(findReportData(blocks)).to.equal(blocks);
    expect(findReportData({ data: blocks })).to.equal(blocks);
    expect(findReportData({ data: { report: blocks } })).to.equal(blocks);
  });

  it("accepts saved files without the bloque_ prefix", () => {
    const saved = { actividadcred: {}, consul: {} };
    expect(findReportData(saved)).to.equal(saved);
  });

  it("returns null for non-report payloads like the history list", () => {
    expect(findReportData({ data: [{ reportId: "x" }], lastEventId: "" })).to.be.null;
    expect(findReportData(null)).to.be.null;
  });
});
