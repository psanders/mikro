/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The spouse share of SUPPORT_NETWORK needs a real contact: filler like
 * "N/A" / "0000000000" once counted as a spouse. The codeudor note keys off
 * the marital status code.
 */
import { expect } from "chai";
import { scoreInput } from "../../src/scoring/engine.js";
import type { ScoreInput } from "../../src/scoring/types.js";

function input(over: Partial<ScoreInput>): ScoreInput {
  return {
    name: "Prospecto Test",
    age: null,
    idNumber: "",
    phone: "",
    businessType: "Colmado",
    businessName: "",
    province: "PUERTO_PLATA",
    monthlySales: "80000",
    requestedAmount: 25000,
    requestedTermWeeks: 12,
    businessAge: null,
    formalization: null,
    locationType: null,
    employeeCount: null,
    housingType: null,
    residenceTime: null,
    homeAddress: null,
    addressReference: null,
    referenceName: null,
    referencePhone: null,
    spouseName: null,
    spousePhone: null,
    businessPhone: null,
    purpose: null,
    maritalStatus: null,
    partial: false,
    ...over
  };
}

const support = (over: Partial<ScoreInput>) =>
  scoreInput(input(over)).categories.find((c) => c.category === "SUPPORT_NETWORK")!.score;

const codeudorNote = (over: Partial<ScoreInput>) =>
  scoreInput(input(over)).evaluator_notes.some((n) => n.topic === "Codeudor");

describe("scoring: spouse support", () => {
  it("counts a spouse with a real Dominican phone", () => {
    expect(support({ spouseName: "Eblis", spousePhone: "(849) 876-8235" })).to.equal(25);
  });

  for (const phone of ["0000000000", "N/A", "12345", ""]) {
    it(`gives nothing for spouse phone ${JSON.stringify(phone)}`, () => {
      expect(support({ spouseName: "N/A", spousePhone: phone })).to.equal(0);
    });
  }
});

describe("scoring: codeudor note", () => {
  for (const status of ["CASADO", "UNION_LIBRE"]) {
    it(`asks for the spouse when ${status} and no spouse given`, () => {
      expect(codeudorNote({ maritalStatus: status })).to.equal(true);
    });
  }

  for (const status of ["SOLTERO", "DIVORCIADO", "VIUDO", null]) {
    it(`does not when ${String(status)}`, () => {
      expect(codeudorNote({ maritalStatus: status })).to.equal(false);
    });
  }
});
