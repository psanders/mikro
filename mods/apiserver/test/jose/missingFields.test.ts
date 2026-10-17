/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { missingApplicationFields } from "../../src/api/jose/missingFields.js";

const base = {
  firstName: "Ada",
  lastName: "Padilla",
  phone: "+18492452419",
  idNumber: "037-0105842-6",
  dateOfBirth: "1987-03-15",
  businessType: "OTRO",
  businessName: "Cafetería",
  requestedAmount: 20000,
  purpose: "Inventario",
  requestedTermWeeks: 12,
  province: "PUERTO_PLATA",
  homeAddress: "San Marcos",
  rawData: {}
};

describe("missingApplicationFields", () => {
  it("leaves spouse fields out for a single applicant", () => {
    const missing = missingApplicationFields({ ...base, maritalStatus: "SOLTERO" });
    expect(missing).to.not.include("spouseName");
    expect(missing).to.not.include("spousePhone");
  });

  it("asks spouse fields for a married applicant", () => {
    const missing = missingApplicationFields({ ...base, maritalStatus: "CASADO" });
    expect(missing).to.include.members(["spouseName", "spousePhone"]);
  });

  it("reads the column code over a stale form label in rawData", () => {
    const missing = missingApplicationFields({
      ...base,
      maritalStatus: "SOLTERO",
      rawData: { maritalStatus: "Casado(a)" }
    });
    expect(missing).to.not.include("spouseName");
  });

  it("asks marital status first when it is unknown, not a spouse", () => {
    const missing = missingApplicationFields({ ...base, maritalStatus: null });
    expect(missing).to.include("maritalStatus");
    expect(missing).to.not.include("spouseName");
  });

  it("asks again when a stale form's label was dropped (column null, label in rawData)", () => {
    const missing = missingApplicationFields({
      ...base,
      maritalStatus: null,
      rawData: { maritalStatus: "Soltero(a)" }
    });
    expect(missing).to.include("maritalStatus");
  });

  it("never lists an optional contact the person declined", () => {
    const missing = missingApplicationFields({
      ...base,
      maritalStatus: "SOLTERO",
      rawData: { declinedFields: ["businessPhone", "referencePhone"] }
    });
    expect(missing).to.not.include("businessPhone");
    expect(missing).to.not.include("referencePhone");
    expect(missing).to.include("referenceName");
  });
});
