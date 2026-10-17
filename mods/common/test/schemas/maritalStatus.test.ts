/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import {
  ESTADO_CIVIL_OPTIONS,
  hasPartner,
  isDrPhone,
  isMaritalStatus,
  maritalStatusLabel
} from "../../src/schemas/applicationForm.js";
import { maritalStatusEnum, normalizeApplication } from "../../src/schemas/application.js";

describe("marital status", () => {
  it("accepts only the codes", () => {
    for (const code of ["SOLTERO", "CASADO", "UNION_LIBRE", "DIVORCIADO", "VIUDO"]) {
      expect(isMaritalStatus(code), code).to.equal(true);
      expect(maritalStatusEnum.safeParse(code).success, code).to.equal(true);
    }
    for (const other of ["Soltero(a)", "soltera", "casado", "", null]) {
      expect(isMaritalStatus(other), String(other)).to.equal(false);
      expect(maritalStatusEnum.safeParse(other).success, String(other)).to.equal(false);
    }
  });

  it("only married and common-law have a partner", () => {
    expect(["CASADO", "UNION_LIBRE"].every(hasPartner)).to.equal(true);
    expect(["SOLTERO", "DIVORCIADO", "VIUDO", "Casado(a)", null].some(hasPartner)).to.equal(false);
  });

  it("form options post codes and show the labels", () => {
    expect(ESTADO_CIVIL_OPTIONS).to.deep.include({ value: "UNION_LIBRE", label: "Unión libre" });
    expect(maritalStatusLabel("SOLTERO")).to.equal("Soltero(a)");
  });

  it("normalizes a code and drops anything else to null (never throws)", () => {
    expect(
      normalizeApplication({ sessionId: "s1", maritalStatus: "CASADO" }).maritalStatus
    ).to.equal("CASADO");
    const stale = normalizeApplication({ sessionId: "s1", maritalStatus: "Casado(a)" });
    expect(stale.maritalStatus).to.equal(null);
    // The answer as sent is still kept with the submission.
    expect(stale.rawData.maritalStatus).to.equal("Casado(a)");
  });
});

describe("isDrPhone", () => {
  for (const ok of ["8095551234", "(829) 524-5888", "+1 849 876 8235"]) {
    it(`accepts ${ok}`, () => expect(isDrPhone(ok)).to.equal(true));
  }
  for (const bad of ["0000000000", "892222222", "N/A", "3055551234"]) {
    it(`rejects ${bad}`, () => expect(isDrPhone(bad)).to.equal(false));
  }
});
