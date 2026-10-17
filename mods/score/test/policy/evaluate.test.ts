/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { creditPolicySchema, type CreditPolicy } from "../../src/policy/schema.js";
import { evaluateCreditPolicy, type Facts } from "../../src/policy/evaluate.js";
import { POLICY_V1 } from "../../src/policy/v1.js";
import { toPcloudFacts } from "../../src/facts/prestamoscloud.js";
import { delinquentScrape, emptyScrape } from "../fixtures/pcloud-delinquent.js";

const NOW = new Date("2026-10-17T12:00:00Z");
const v1 = creditPolicySchema.parse(POLICY_V1);

function pcloud(scrape = emptyScrape) {
  const f = toPcloudFacts(scrape);
  return { ...f, ageDays: 0, loans: f.lenders.flatMap((l) => l.loans) };
}

const cleanEquifax = {
  identity: null,
  bureauScore: null,
  ageDays: 1,
  mikroScore: 760,
  features: { worstRiskDpd: 0, countByStatus: { NORMAL: 3, MORA: 0, LEGAL: 0, CASTIGADO: 0 } }
};

/** A complete, clean applicant; each test removes or changes what it needs. */
function base(): Facts {
  return {
    app: { province: "Puerto Plata", ageYears: 35, firstName: "Marisol", lastName: "Peña" },
    isc: { score: 70, flags: [] },
    mikro: { customerExists: false, tags: [], loans: [] },
    config: { coveredProvinces: ["PUERTO_PLATA"] },
    checks: { identity: {} }
  };
}

function minimal(over: Partial<CreditPolicy>): CreditPolicy {
  return creditPolicySchema.parse({
    id: "t",
    version: "0.0.1",
    facts: {},
    rules: [],
    score: {
      components: [
        { id: "x", label: "X", weight: 1, value: { fact: "x" }, map: { from: [0, 100] } }
      ]
    },
    bands: [{ min: 0, outcome: "APPROVE" }],
    ...over
  });
}

describe("credit policy schema", () => {
  it("accepts the bundled v1 policy", () => {
    expect(creditPolicySchema.safeParse(POLICY_V1).success).to.equal(true);
  });

  it("rejects unknown keys and operators", () => {
    expect(creditPolicySchema.safeParse({ ...POLICY_V1, extra: 1 }).success).to.equal(false);
    const bad = {
      ...POLICY_V1,
      rules: [{ ...POLICY_V1.rules[0], when: { left: 1, op: "approximately", right: 1 } }]
    };
    expect(creditPolicySchema.safeParse(bad).success).to.equal(false);
  });

  it("requires a band starting at 0", () => {
    expect(
      creditPolicySchema.safeParse({ ...POLICY_V1, bands: [{ min: 50, outcome: "APPROVE" }] })
        .success
    ).to.equal(false);
  });
});

describe("evaluateCreditPolicy · expressions", () => {
  const ev = (rule: object, facts: Facts) =>
    evaluateCreditPolicy(
      minimal({
        rules: [{ id: "R", when: rule as never, outcome: "REJECT", reason: "R", message: "r" }]
      }),
      { x: 50, ...facts },
      NOW
    ).trace.rules[0].result;

  it("compares numbers, lists and strings", () => {
    expect(ev({ left: { fact: "a" }, op: "gte", right: 3 }, { a: 3 })).to.equal("true");
    expect(ev({ left: { fact: "a" }, op: "in", right: ["X", "Y"] }, { a: "Y" })).to.equal("true");
    expect(ev({ left: { fact: "a" }, op: "contains", right: "b" }, { a: ["a", "b"] })).to.equal(
      "true"
    );
    expect(ev({ left: { fact: "a" }, op: "between", right: [1, 5] }, { a: 6 })).to.equal("false");
    expect(ev({ left: { fact: "a" }, op: "matches", right: "^40[12]" }, { a: "402-1" })).to.equal(
      "true"
    );
  });

  it("propagates unknown with Kleene logic", () => {
    expect(ev({ left: { fact: "nope" }, op: "eq", right: 1 }, {})).to.equal("unknown");
    expect(
      ev(
        {
          any: [
            { left: { fact: "nope" }, op: "eq", right: 1 },
            { left: 1, op: "eq", right: 1 }
          ]
        },
        {}
      )
    ).to.equal("true");
    expect(
      ev(
        {
          all: [
            { left: { fact: "nope" }, op: "eq", right: 1 },
            { left: 1, op: "eq", right: 2 }
          ]
        },
        {}
      )
    ).to.equal("false");
    expect(ev({ not: { left: { fact: "nope" }, op: "eq", right: 1 } }, {})).to.equal("unknown");
  });

  it("aggregates with filters, arithmetic, coalesce and dates", () => {
    const facts = {
      loans: [
        { d: 10, u: true },
        { d: 200, u: false },
        { d: 30, u: true }
      ],
      dob: "1990-10-18"
    };
    expect(
      ev(
        {
          left: {
            agg: "count",
            of: "loans",
            where: { left: { fact: "$.u" }, op: "eq", right: true }
          },
          op: "eq",
          right: 2
        },
        facts
      )
    ).to.equal("true");
    expect(
      ev({ left: { agg: "max", of: "loans", field: "$.d" }, op: "eq", right: 200 }, facts)
    ).to.equal("true");
    expect(
      ev(
        {
          left: { op: "div", args: [{ agg: "sum", of: "loans", field: "$.d" }, 2] },
          op: "eq",
          right: 120
        },
        facts
      )
    ).to.equal("true");
    expect(ev({ left: { coalesce: [{ fact: "nope" }, 7] }, op: "eq", right: 7 }, facts)).to.equal(
      "true"
    );
    expect(ev({ left: { yearsSince: { fact: "dob" } }, op: "eq", right: 35 }, facts)).to.equal(
      "true"
    );
    expect(
      ev({ left: { normalize: "Puerto Plata." }, op: "eq", right: "PUERTO_PLATA" }, facts)
    ).to.equal("true");
    expect(
      ev({ any_item: "loans", where: { left: { fact: "$.d" }, op: "gt", right: 100 } }, facts)
    ).to.equal("true");
  });
});

describe("evaluateCreditPolicy · v1 policy", () => {
  it("decides with the information in hand: no bureau lookups, still approvable", () => {
    const facts = base();
    (facts.mikro as Record<string, unknown>).paymentRating = 5;
    (facts.isc as Record<string, unknown>).score = 72;
    const d = evaluateCreditPolicy(v1, facts, NOW);
    expect(d.outcome).to.equal("APPROVE");
    expect(d.sourcesUsed).to.deep.equal(["isc", "history"]);
    expect(d.unchecked.map((u) => u.reason)).to.include.members([
      "PCLOUD_DELINQUENT",
      "PCLOUD_UNCOLLECTIBLE",
      "EQUIFAX_WRITE_OFF",
      "EQUIFAX_DPD_90"
    ]);
    expect(d.nextSteps.map((s) => s.id)).to.deep.equal(["equifax_lookup", "pcloud_lookup"]);
    expect(d.nextSteps.every((s) => s.couldChange)).to.equal(true);
  });

  it("a hard NO rejects even with other sources missing", () => {
    const facts = { ...base(), pcloud: pcloud(delinquentScrape) };
    const d = evaluateCreditPolicy(v1, facts, NOW);
    expect(d.outcome).to.equal("REJECT");
    expect(d.reasons.map((r) => r.code)).to.deep.equal([
      "PCLOUD_DELINQUENT",
      "PCLOUD_UNCOLLECTIBLE"
    ]);
  });

  it("combines every consulted source into the Mikro Score", () => {
    const facts = { ...base(), equifax: cleanEquifax, pcloud: pcloud() };
    const d = evaluateCreditPolicy(v1, facts, NOW);
    // equifax (760-150)/800 = 76.25, pcloud missing score (NO DATOS) skipped, isc 70 → (30·76.25 + 30·70)/60
    expect(d.mikroScore).to.equal(73);
    expect(d.sourcesUsed).to.deep.equal(["equifax", "isc"]);
    expect(d.outcome).to.equal("APPROVE");
    // Neither bureau showed an identity block here: the check stays "no verificado",
    // but both sources were consulted, so no paid lookup is suggested again.
    expect(d.unchecked.map((u) => u.reason)).to.deep.equal(["IDENTITY_MISMATCH"]);
    expect(d.nextSteps).to.deep.equal([]);
  });

  it("a low score asks for review, it never rejects", () => {
    const facts = base();
    (facts.isc as Record<string, unknown>).score = 30;
    const d = evaluateCreditPolicy(v1, facts, NOW);
    expect(d.outcome).to.equal("REVIEW");
    expect(d.reasons).to.deep.equal([{ code: "LOW_MIKRO_SCORE", message: "Mikro Score bajo" }]);
  });

  it("rejects out of the coverage area, by normalized province", () => {
    const facts = base();
    (facts.app as Record<string, unknown>).province = "Santiago";
    expect(evaluateCreditPolicy(v1, facts, NOW).reasons[0].code).to.equal("OUT_OF_COVERAGE_AREA");
    (facts.app as Record<string, unknown>).province = "puerto plata.";
    expect(evaluateCreditPolicy(v1, facts, NOW).outcome).to.not.equal("REJECT");
  });

  it("a missing birth date leaves the age rule unchecked (no false rejection)", () => {
    const facts = base();
    delete (facts.app as Record<string, unknown>).ageYears;
    const d = evaluateCreditPolicy(v1, facts, NOW);
    expect(d.outcome).to.not.equal("REJECT");
    expect(d.unchecked.map((u) => u.reason)).to.include("AGE_OUT_OF_RANGE");
  });

  it("rejects Mikro history and identity problems", () => {
    const fraud = base();
    (fraud.mikro as Record<string, unknown>).tags = ["risk:fraud_watch"];
    expect(evaluateCreditPolicy(v1, fraud, NOW).reasons[0].code).to.equal("MIKRO_FRAUD_WATCH");
    const id = base();
    id.checks = { identity: { pcloud: { nameMatches: false, birthDateMatches: true } } };
    expect(evaluateCreditPolicy(v1, id, NOW).reasons[0].code).to.equal("IDENTITY_MISMATCH");
  });

  it("is deterministic (replayable)", () => {
    const facts = { ...base(), equifax: cleanEquifax, pcloud: pcloud(delinquentScrape) };
    const a = evaluateCreditPolicy(v1, JSON.parse(JSON.stringify(facts)), NOW);
    const b = evaluateCreditPolicy(v1, JSON.parse(JSON.stringify(facts)), NOW);
    expect(a).to.deep.equal(b);
  });

  it("a new hard NO is just policy JSON", () => {
    const policy = creditPolicySchema.parse({
      ...POLICY_V1,
      rules: [
        ...POLICY_V1.rules,
        {
          id: "KO_TOO_MANY_LENDERS",
          when: { left: { fact: "pcloud.kpis.lenderCount" }, op: "gt", right: 10 },
          outcome: "REJECT",
          reason: "TOO_MANY_LENDERS",
          message: "Más de 10 empresas"
        }
      ]
    });
    const scrape = {
      ...emptyScrape,
      summary: { ...emptyScrape.summary, "Empresas con este cliente": "11" }
    };
    const d = evaluateCreditPolicy(policy, { ...base(), pcloud: pcloud(scrape) }, NOW);
    expect(d.reasons.map((r) => r.code)).to.deep.equal(["TOO_MANY_LENDERS"]);
  });
});
