/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Regression tests for the OUT_OF_ZONE flag. The coverage zone is configured as
 * the enum key "PUERTO_PLATA", while applications store the display value
 * ("Puerto Plata"). The scorer must normalize both sides so the served province
 * is never flagged out-of-zone regardless of how it was captured.
 */
import { expect } from "chai";
import { scoreInput } from "../../src/scoring/engine.js";
import type { ScoreInput } from "../../src/scoring/types.js";

function inputWithProvince(province: string): ScoreInput {
  return {
    name: "Prospecto Test",
    age: null,
    idNumber: "",
    phone: "",
    businessType: "Colmado",
    businessName: "",
    province,
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
    partial: false
  };
}

function isOutOfZone(province: string): boolean {
  return scoreInput(inputWithProvince(province)).flags.some((f) => f.code === "OUT_OF_ZONE");
}

describe("scoring: OUT_OF_ZONE flag", () => {
  describe("served province is NOT flagged, regardless of capture form", () => {
    for (const province of ["Puerto Plata", "Puerto Plata.", "puerto  plata", "PUERTO_PLATA"]) {
      it(`accepts ${JSON.stringify(province)}`, () => {
        expect(isOutOfZone(province)).to.equal(false);
      });
    }
  });

  describe("provinces outside the coverage zone ARE flagged", () => {
    for (const province of ["Santiago", "Samaná", "Distrito Nacional"]) {
      it(`flags ${JSON.stringify(province)}`, () => {
        expect(isOutOfZone(province)).to.equal(true);
      });
    }
  });

  it("does not flag when no province is set yet (early intake)", () => {
    expect(isOutOfZone("")).to.equal(false);
  });
});
