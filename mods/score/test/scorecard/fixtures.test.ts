/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Regression tests on anonymized real reports (see test/fixtures/*.json _note).
 */
import { expect } from "chai";
import { readFileSync } from "node:fs";
import { fromInteractiveReport } from "../../src/adapter.js";
import { scoreReport } from "../../src/scorecard.js";
import type { BureauReport } from "../../src/types.js";

const load = (name: string) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));

// The saved API fixture keeps the four credit blocks without the "bloque_" prefix.
const toResponseData = (saved: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(saved)
      .filter(([k]) => k !== "_note")
      .map(([k, v]) => [`bloque_${k}`, v])
  );

describe("anonymized real reports", () => {
  it("API response with two charge-offs scores at the floor", () => {
    const report = fromInteractiveReport(
      toResponseData(load("api-severe-chargeoffs.json")),
      "2026-05-13"
    );
    const r = scoreReport(report);
    expect(report.accounts).to.have.length(5);
    expect(r.features.countByStatus).to.deep.equal({ NORMAL: 0, MORA: 1, LEGAL: 0, CASTIGADO: 2 });
    expect(r.features.inquiries6m).to.equal(5);
    expect(r).to.include({ score: 150, raw: 51, cap: 520, band: "Muy bajo" });
    expect(r.reasons[0]).to.equal("2 cuenta(s) castigada(s)");
  });

  it("transcribed report with legal accounts scores at the floor", () => {
    const r = scoreReport(load("report-severe-legal.json") as BureauReport);
    expect(r.features.countByStatus).to.deep.equal({ NORMAL: 1, MORA: 2, LEGAL: 2, CASTIGADO: 1 });
    expect(r).to.include({ score: 150, raw: -70, cap: 520, band: "Muy bajo" });
  });
});
