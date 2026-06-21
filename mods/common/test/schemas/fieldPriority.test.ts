/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * FIELD_PRIORITY is the single source of truth for the order José asks intake
 * questions. These tests pin the contract: knockouts + highest-weight fields
 * come first, and sortByFieldPriority is a stable, total ordering over the
 * canonical content keys.
 */
import { expect } from "chai";
import {
  APPLICATION_CONTENT_KEYS,
  FIELD_PRIORITY,
  sortByFieldPriority
} from "../../src/schemas/application.js";

describe("FIELD_PRIORITY", () => {
  it("covers every content key exactly once", () => {
    const priority = [...FIELD_PRIORITY].sort();
    const keys = [...APPLICATION_CONTENT_KEYS].sort();
    expect(priority).to.deep.equal(keys);
  });

  it("puts the knockout fields first", () => {
    expect(FIELD_PRIORITY[0]).to.equal("province"); // OUT_OF_ZONE
    expect(FIELD_PRIORITY[1]).to.equal("businessType"); // CRITICAL_BUSINESS
  });

  it("ranks the highest-weight capacity fields ahead of low-weight fields", () => {
    const idx = (k: string) => FIELD_PRIORITY.indexOf(k as (typeof FIELD_PRIORITY)[number]);
    // capacidad_pago (weight 30) before red_soporte (weight 10)
    expect(idx("monthlySales")).to.be.lessThan(idx("referenceName"));
    expect(idx("requestedAmount")).to.be.lessThan(idx("spousePhone"));
    // riesgo_negocio (20) before arraigo (15)
    expect(idx("businessType")).to.be.lessThan(idx("housingType"));
  });
});

describe("sortByFieldPriority", () => {
  it("orders a subset by priority regardless of input order", () => {
    const input = ["referencePhone", "province", "monthlySales", "businessType"];
    expect(sortByFieldPriority(input)).to.deep.equal([
      "province",
      "businessType",
      "monthlySales",
      "referencePhone"
    ]);
  });

  it("does not mutate the input array", () => {
    const input = ["spousePhone", "province"];
    const copy = [...input];
    sortByFieldPriority(input);
    expect(input).to.deep.equal(copy);
  });

  it("sends unknown keys to the end without dropping them", () => {
    const out = sortByFieldPriority(["mystery", "province"]);
    expect(out[0]).to.equal("province");
    expect(out).to.include("mystery");
    expect(out).to.have.length(2);
  });
});
