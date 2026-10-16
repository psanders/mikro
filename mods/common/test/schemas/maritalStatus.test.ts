/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import {
  ESTADO_CIVIL_OPTIONS,
  hasPartner,
  isDrPhone,
  maritalStatusLabel,
  parseMaritalStatus
} from "../../src/schemas/applicationForm.js";
import { normalizeApplication } from "../../src/schemas/application.js";

describe("marital status", () => {
  const cases: Array<[string, string | null]> = [
    ["SOLTERO", "SOLTERO"],
    ["Soltero(a)", "SOLTERO"],
    ["Soltero/a", "SOLTERO"],
    ["soltera", "SOLTERO"],
    ["Casada", "CASADO"],
    ["Unión libre", "UNION_LIBRE"],
    ["UNION LIBRE", "UNION_LIBRE"],
    ["Divorciado(a)", "DIVORCIADO"],
    ["Viuda", "VIUDO"],
    ["N/A", null],
    ["", null]
  ];
  for (const [input, code] of cases) {
    it(`parses ${JSON.stringify(input)} as ${code}`, () => {
      expect(parseMaritalStatus(input)).to.equal(code);
    });
  }

  it("only married and common-law have a partner", () => {
    expect(["CASADO", "UNION_LIBRE"].every(hasPartner)).to.equal(true);
    expect(["SOLTERO", "DIVORCIADO", "VIUDO", null].some(hasPartner)).to.equal(false);
  });

  it("form options post codes and show the labels", () => {
    expect(ESTADO_CIVIL_OPTIONS).to.deep.include({ value: "UNION_LIBRE", label: "Unión libre" });
    expect(maritalStatusLabel("SOLTERO")).to.equal("Soltero(a)");
  });

  it("normalizes an old form label to a code", () => {
    expect(
      normalizeApplication({ sessionId: "s1", maritalStatus: "Casado(a)" }).maritalStatus
    ).to.equal("CASADO");
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
