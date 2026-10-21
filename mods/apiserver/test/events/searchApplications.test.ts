/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { fold, matchesApplication } from "../../src/api/events/searchApplications.js";

const juan = {
  firstName: "Juan Carlos",
  lastName: "Pérez Núñez",
  businessName: "Colmado La Esquina",
  phone: "+1 (809) 555-0142",
  idNumber: "031-0567812-4"
};

describe("searchApplications.matchesApplication", () => {
  it("folds case and accents", () => {
    expect(fold("  PÉREZ Núñez ")).to.equal("perez nunez");
  });

  it("matches a partial name in any order, ignoring accents", () => {
    expect(matchesApplication(juan, "juan per")).to.equal(true);
    expect(matchesApplication(juan, "PEREZ juan")).to.equal(true);
    expect(matchesApplication(juan, "nunez")).to.equal(true);
    expect(matchesApplication(juan, "juan carlos perez nunez")).to.equal(true);
  });

  it("matches the business name too", () => {
    expect(matchesApplication(juan, "esquina")).to.equal(true);
  });

  it("requires every word to match", () => {
    expect(matchesApplication(juan, "juan lopez")).to.equal(false);
  });

  it("matches a cédula with or without dashes, and partially", () => {
    expect(matchesApplication(juan, "031-0567812-4")).to.equal(true);
    expect(matchesApplication(juan, "03105678124")).to.equal(true);
    expect(matchesApplication(juan, "567812")).to.equal(true);
    expect(matchesApplication(juan, "031-0567812-9")).to.equal(false);
  });

  it("matches a phone however it is typed or stored", () => {
    expect(matchesApplication(juan, "809 555 0142")).to.equal(true);
    expect(matchesApplication(juan, "8095550142")).to.equal(true);
    expect(matchesApplication(juan, "+18095550142")).to.equal(true);
    expect(matchesApplication({ ...juan, phone: "8095550142" }, "(809) 555-0142")).to.equal(true);
    expect(matchesApplication(juan, "809 555 0199")).to.equal(false);
  });

  it("ignores queries with fewer than 3 digits and empty queries", () => {
    expect(matchesApplication(juan, "03")).to.equal(false);
    expect(matchesApplication(juan, "   ")).to.equal(false);
  });

  it("copes with missing fields", () => {
    const empty = {
      firstName: null,
      lastName: null,
      businessName: null,
      phone: null,
      idNumber: null
    };
    expect(matchesApplication(empty, "juan")).to.equal(false);
    expect(matchesApplication(empty, "809 555")).to.equal(false);
  });
});
