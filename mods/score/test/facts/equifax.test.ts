/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { readFileSync } from "node:fs";
import { toEquifaxFacts } from "../../src/facts/equifax.js";
import { equifaxFactsSchema } from "../../src/facts/schema.js";
import { birthDateMatches, nameMatches } from "../../src/facts/identity.js";

const api = JSON.parse(
  readFileSync(new URL("../fixtures/api-severe-chargeoffs.json", import.meta.url), "utf8")
);

describe("Equifax facts", () => {
  it("maps the credit blocks and validates", () => {
    const { facts, cedula } = toEquifaxFacts(api, "2026-10-13");
    expect(equifaxFactsSchema.safeParse(facts).success).to.equal(true);
    expect(facts.accounts.length).to.be.greaterThan(0);
    expect(facts.identity).to.equal(null);
    expect(facts.bureauScore).to.equal(null);
    expect(cedula).to.equal(null);
  });

  it("reads identity and the bureau score when present", () => {
    const { facts, cedula } = toEquifaxFacts(
      {
        ...api,
        bloque_identi: {
          identi: [
            {
              nombres: "Marisol",
              apellidos: "Peña Díaz",
              fechaNacimiento: "20/04/1990",
              cedula: "40212345678"
            }
          ]
        },
        bloque_dashb: { dashb: [{ score: 612, rango: "Bajo" }] }
      },
      "2026-10-13"
    );
    expect(facts.identity).to.deep.equal({
      fullName: "Marisol Peña Díaz",
      birthDate: "1990-04-20"
    });
    expect(facts.bureauScore).to.deep.equal({ value: 612, label: "Bajo" });
    expect(cedula).to.equal("402-1234567-8");
  });
});

describe("identity checks", () => {
  it("matches names loosely", () => {
    expect(
      nameMatches({ firstName: "Ramon", lastName: "Ortiz" }, "RAMÓN ANTONIO ORTIZ PÉREZ")
    ).to.equal(true);
    expect(nameMatches({ firstName: "Ramón", lastName: "Ortiz" }, "Luis Pérez")).to.equal(false);
  });

  it("compares birth dates", () => {
    expect(birthDateMatches("1990-04-20", "1990-04-20")).to.equal(true);
    expect(birthDateMatches("1990-04-20", "1991-04-20")).to.equal(false);
    expect(birthDateMatches(null, "1991-04-20")).to.equal(true);
  });
});
