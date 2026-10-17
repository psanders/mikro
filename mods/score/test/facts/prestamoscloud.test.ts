/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import {
  allLendersLoaded,
  parseLoanRow,
  parseLoanStatus,
  parseMoney,
  parseSpanishDate,
  toPcloudFacts
} from "../../src/facts/prestamoscloud.js";
import { pcloudFactsSchema } from "../../src/facts/schema.js";
import { delinquentScrape, emptyScrape } from "../fixtures/pcloud-delinquent.js";

describe("PrestamosCloud facts", () => {
  it("parses money, including negative leftovers and blanks", () => {
    expect(parseMoney("RD$86,673.12")).to.equal(86673.12);
    expect(parseMoney("RD$-0.19")).to.equal(-0.19);
    expect(parseMoney("—")).to.equal(null);
  });

  it("parses Spanish short dates", () => {
    expect(parseSpanishDate("31 mar 2026")).to.equal("2026-03-31");
    expect(parseSpanishDate("23 sept 2025")).to.equal("2025-09-23");
    expect(parseSpanishDate("4 ago 2025")).to.equal("2025-08-04");
    expect(parseSpanishDate("—")).to.equal(null);
  });

  it("splits the INCOBRABLE badge from the status, glued or spaced", () => {
    expect(parseLoanStatus("VENCIDOSINCOBRABLE")).to.deep.equal({
      status: "VENCIDOS",
      uncollectible: true
    });
    expect(parseLoanStatus("ATRASADOS INCOBRABLE")).to.deep.equal({
      status: "ATRASADOS",
      uncollectible: true
    });
    expect(parseLoanStatus("Al día")).to.deep.equal({ status: "AL_DIA", uncollectible: false });
  });

  it("keeps an unknown status verbatim", () => {
    expect(parseLoanStatus("REESTRUCTURADO")).to.deep.equal({
      status: "OTHER",
      statusRaw: "REESTRUCTURADO",
      uncollectible: false
    });
  });

  it("reads a loan row", () => {
    expect(
      parseLoanRow(["RD$10,000.00", "ATRASADOS", "—", "200 d", "31 mar 2026", "", "RD$10,000.00"])
    ).to.deep.equal({
      amount: 10000,
      status: "ATRASADOS",
      uncollectible: false,
      finalCondition: null,
      daysLate: 200,
      startDate: "2026-03-31",
      rating: null,
      principalOwed: 10000
    });
  });

  it("maps a delinquent profile and validates against the schema", () => {
    const facts = toPcloudFacts(delinquentScrape);
    expect(pcloudFactsSchema.safeParse(facts).success).to.equal(true);
    expect(facts.kpis.score).to.deep.equal({ value: 399, label: "Muy bajo" });
    expect(facts.kpis.isDelinquent).to.equal(true);
    expect(facts.kpis.onTimePct).to.equal(23);
    expect(facts.kpis.riskFactors).to.deep.equal({ count: 4, max: 4, label: "Riesgo alto" });
    expect(facts.kpis.lenderCount).to.equal(14);
    expect(facts.kpis.totalOwed).to.equal(86673.12);
    expect(facts.identity).to.deep.equal({
      fullName: "Ramón Ortiz",
      birthDate: "1972-04-20",
      gender: "M"
    });
    const loans = facts.lenders.flatMap((l) => l.loans);
    expect(loans).to.have.length(6);
    expect(loans.filter((l) => l.uncollectible)).to.have.length(3);
    expect(facts.lenders[0]).to.include({
      name: "Inversiones Uno",
      loanCount: 3,
      totalLent: 25000,
      totalOwed: 12000
    });
  });

  it("maps the NO DATOS result", () => {
    const facts = toPcloudFacts(emptyScrape);
    expect(pcloudFactsSchema.safeParse(facts).success).to.equal(true);
    expect(facts.kpis.score).to.equal(null);
    expect(facts.kpis.isDelinquent).to.equal(false);
    expect(facts.identity).to.equal(null);
    expect(facts.lenders).to.deep.equal([]);
  });

  it("knows when some lenders are still collapsed", () => {
    expect(allLendersLoaded(delinquentScrape)).to.equal(true);
    const partial = {
      ...delinquentScrape,
      lenders: [...delinquentScrape.lenders, { ...delinquentScrape.lenders[0], rows: null }]
    };
    expect(allLendersLoaded(partial)).to.equal(false);
  });
});
