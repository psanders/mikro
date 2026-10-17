/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { bandOf, scoreReport } from "../../src/scorecard.js";
import type { BureauReport } from "../../src/types.js";

const cleanFile: BureauReport = {
  reportDate: "2026-10-13",
  inquiries: [],
  summary: { oldestCredit: "2018-01", newestCredit: "2024-01" },
  accounts: [
    {
      ref: 1,
      sector: "BCO",
      product: "TCR",
      status: "NORMAL",
      pdv: "000000000000",
      util: "111111111111",
      approved: 50000,
      owed: 5000,
      overdue: 0
    },
    {
      ref: 2,
      sector: "FIN",
      product: "PRE",
      status: "CANCELADA",
      pdv: "000000000000",
      util: "000000000000"
    }
  ]
};

// Synthetic file shaped like a real severe case: written-off loan, card in legal, recent inquiries.
const severeFile: BureauReport = {
  reportDate: "2026-10-13",
  inquiries: [{ date: "2026-09-07" }, { date: "2026-07-08" }, { date: "2026-06-08" }],
  summary: { oldestCredit: "2022-01", newestCredit: "2026-06" },
  accounts: [
    {
      ref: 1,
      sector: "PRE",
      status: "CASTIGADO",
      pdv: "IIIIIIIL221.",
      util: "666666666666",
      owed: 12000,
      overdue: 5000
    },
    {
      ref: 2,
      sector: "BCO",
      status: "LEGAL",
      pdv: "-LLLLLLLLLLL",
      util: "-55555555555",
      owed: 10000,
      overdue: 2300
    },
    { ref: 3, sector: "PRE", status: "CANCELADA", pdv: "000000000000", util: "000000000000" }
  ]
};

describe("scoreReport", () => {
  it("puts a severe file in the lowest band with derogatory reasons", () => {
    const r = scoreReport(severeFile);
    expect(r.band).to.equal("Muy bajo");
    expect(r.score).to.be.at.most(520);
    expect(r.reasons.some((x) => x.includes("castigada"))).to.be.true;
    expect(r.reasons.some((x) => x.includes("legal"))).to.be.true;
  });

  it("scores a clean, seasoned file Bueno or better", () => {
    expect(scoreReport(cleanFile).score).to.be.at.least(720);
  });

  it("drops a clean file sharply after a single 60-day late", () => {
    const late = structuredClone(cleanFile);
    late.accounts[0].pdv = "000200000000";
    expect(scoreReport(late).score!).to.be.below(scoreReport(cleanFile).score! - 80);
  });

  it("ignores delinquencies older than the 24-month payment window for severity", () => {
    const old = structuredClone(cleanFile);
    old.accounts[0].pdv = "0".repeat(30) + "2" + "0".repeat(17);
    expect(scoreReport(old).features.worstRiskDpd).to.equal(0);
  });

  it("returns no score for a no-hit file", () => {
    const r = scoreReport({
      ...cleanFile,
      accounts: [
        { ref: 1, sector: "FIN", status: "CANCELADA", pdv: "------------", util: "------------" }
      ]
    });
    expect(r.score).to.be.null;
    expect(r.band).to.equal("Sin historial");
  });
});

describe("bandOf", () => {
  it("follows DataCrédito RD cut-offs", () => {
    expect(bandOf(600)).to.equal("Muy bajo");
    expect(bandOf(601)).to.equal("Bajo");
    expect(bandOf(658)).to.equal("Justo");
    expect(bandOf(720)).to.equal("Bueno");
    expect(bandOf(781)).to.equal("Excelente");
  });
});
