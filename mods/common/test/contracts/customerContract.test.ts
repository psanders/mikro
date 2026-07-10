/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The customer -> ContractData mapper: identity is sourced from the customer
 * row, terms from the founder input, occupation override wins over the
 * customer's job position, and dates are normalized.
 */
import { expect } from "chai";
import {
  buildContractDataFromCustomer,
  type CustomerContractIdentity,
  type CustomerContractTerms
} from "../../src/contracts/customerContract.js";

const customer: CustomerContractIdentity = {
  name: "Enersida Brito Estrella",
  idNumber: "071-0047001-7",
  homeAddress: "San marco monterico",
  jobPosition: "Comerciante"
};

const terms: CustomerContractTerms = {
  principal: 8256,
  installments: 10,
  installmentAmount: 1100,
  frequency: "WEEKLY",
  startDate: "2026-07-20T12:00:00.000Z"
};

describe("buildContractDataFromCustomer", () => {
  it("sources identity from the customer and terms from the input", () => {
    const contractDate = new Date("2026-07-10T12:00:00.000Z");
    const data = buildContractDataFromCustomer(customer, terms, contractDate);

    expect(data.debtor.name).to.equal("Enersida Brito Estrella");
    expect(data.debtor.cedula).to.equal("071-0047001-7");
    expect(data.debtor.city).to.equal("San marco monterico");
    expect(data.debtor.occupation).to.equal("Comerciante");
    expect(data.principal).to.equal(8256);
    expect(data.installments).to.equal(10);
    expect(data.installmentAmount).to.equal(1100);
    expect(data.frequency).to.equal("WEEKLY");
    expect(data.startDate.toISOString()).to.equal("2026-07-20T12:00:00.000Z");
    expect(data.contractDate).to.equal(contractDate);
  });

  it("lets an occupation override win over the customer's job position", () => {
    const data = buildContractDataFromCustomer(customer, {
      ...terms,
      occupation: "Empleada privada"
    });
    expect(data.debtor.occupation).to.equal("Empleada privada");
  });

  it("falls back to the customer job position when no override is given", () => {
    const data = buildContractDataFromCustomer({ ...customer, jobPosition: "Colmadera" }, terms);
    expect(data.debtor.occupation).to.equal("Colmadera");
  });

  it("leaves occupation undefined when neither override nor job position exists", () => {
    const data = buildContractDataFromCustomer({ ...customer, jobPosition: null }, terms);
    expect(data.debtor.occupation).to.be.undefined;
  });

  it("passes marital status through and defaults it to undefined", () => {
    expect(buildContractDataFromCustomer(customer, terms).debtor.maritalStatus).to.be.undefined;
    expect(
      buildContractDataFromCustomer(customer, { ...terms, maritalStatus: "casada" }).debtor
        .maritalStatus
    ).to.equal("casada");
  });

  it("anchors a bare yyyy-mm-dd start date at local noon (stable calendar day)", () => {
    const data = buildContractDataFromCustomer(customer, { ...terms, startDate: "2026-07-20" });
    // Local noon on the 20th — never rolls back to the 19th under a negative
    // UTC offset the way UTC-midnight would.
    expect(data.startDate.getFullYear()).to.equal(2026);
    expect(data.startDate.getMonth()).to.equal(6);
    expect(data.startDate.getDate()).to.equal(20);
    expect(data.startDate.getHours()).to.equal(12);
  });

  it("accepts a Date startDate as-is and defaults contractDate to now", () => {
    const start = new Date("2026-08-01T00:00:00.000Z");
    const before = Date.now();
    const data = buildContractDataFromCustomer(customer, { ...terms, startDate: start });
    expect(data.startDate).to.equal(start);
    expect(data.contractDate.getTime()).to.be.at.least(before);
  });
});
