/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * accounting.disbursementAccountId must be a required, valid config field
 * (mikro/#155): the apiserver should refuse to boot without it rather than
 * fail later, silently, at the first loan conversion.
 */
import { expect } from "chai";
import { mikroConfigSchema, getDisbursementAccountOptions } from "../src/config.js";

const model = { vendor: "openai", apiKey: "k", model: "gpt-4o-mini" };

const minimalRequiredFields = {
  cx: { model, visionModel: { vendor: "openai", apiKey: "k", model: "gpt-4o" } },
  copilot: { model },
  reports: { model },
  whatsapp: {
    phoneNumberId: "123",
    accessToken: "token"
  },
  applications: { coveredProvinces: ["PUERTO_PLATA"], summaryModel: model }
};

describe("mikroConfigSchema — accounting.disbursementAccountId", () => {
  it("rejects a config with no accounting section at all", () => {
    const parsed = mikroConfigSchema.safeParse({ ...minimalRequiredFields });
    expect(parsed.success).to.equal(false);
  });

  it("rejects an accounting section missing disbursementAccountId", () => {
    const parsed = mikroConfigSchema.safeParse({
      ...minimalRequiredFields,
      accounting: { attachmentsPath: "./data/attachments/accounting" }
    });
    expect(parsed.success).to.equal(false);
  });

  it("rejects a non-UUID disbursementAccountId", () => {
    const parsed = mikroConfigSchema.safeParse({
      ...minimalRequiredFields,
      accounting: { disbursementAccountId: "not-a-uuid" }
    });
    expect(parsed.success).to.equal(false);
  });

  it("accepts a valid UUID disbursementAccountId", () => {
    const parsed = mikroConfigSchema.safeParse({
      ...minimalRequiredFields,
      accounting: { disbursementAccountId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1" }
    });
    expect(parsed.success).to.equal(true);
    if (parsed.success) {
      expect(parsed.data.accounting.disbursementAccountId).to.equal(
        "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1"
      );
      expect(parsed.data.accounting.attachmentsPath).to.equal("./data/attachments/accounting");
    }
  });
});

describe("mikroConfigSchema — qcobro.portfolios[].match tag shapes", () => {
  const withAccounting = {
    ...minimalRequiredFields,
    accounting: { disbursementAccountId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1" }
  };

  const withPortfolio = (matchTags: string[]) => ({
    ...withAccounting,
    // Every other qcobro field defaults; the schema is .strict(), so only send `portfolios`.
    qcobro: {
      portfolios: [{ id: "por-vencer", match: { any: matchTags } }]
    }
  });

  // Regression (prod incident, v1.40.0): config.ts kept its own copy of the tag
  // regex that never learned `due:`, so a portfolio referencing due: tags failed
  // config validation at boot. The shape check now shares customerTag's schema.
  it("accepts due: tags in a portfolio match rule", () => {
    const parsed = mikroConfigSchema.safeParse(withPortfolio(["due:today", "due:1_3"]));
    expect(parsed.success).to.equal(true);
  });

  it("accepts status:, dpd:, due:, and risk: tags together", () => {
    const parsed = mikroConfigSchema.safeParse(
      withPortfolio(["status:current", "dpd:8_30", "due:4_7", "risk:premium"])
    );
    expect(parsed.success).to.equal(true);
  });

  it("rejects a tag in an unknown namespace", () => {
    const parsed = mikroConfigSchema.safeParse(withPortfolio(["bogus:whatever"]));
    expect(parsed.success).to.equal(false);
  });
});

describe("mikroConfigSchema — applications.coveredProvinces", () => {
  const withoutApplications: Record<string, unknown> = { ...minimalRequiredFields };
  delete withoutApplications.applications;
  const base = {
    ...withoutApplications,
    accounting: { disbursementAccountId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1" }
  };

  it("rejects a config with no applications section (boot must fail)", () => {
    const parsed = mikroConfigSchema.safeParse(base);
    expect(parsed.success).to.equal(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.join(".") === "applications")).to.equal(true);
    }
  });

  it("rejects an applications section missing coveredProvinces", () => {
    const parsed = mikroConfigSchema.safeParse({ ...base, applications: {} });
    expect(parsed.success).to.equal(false);
  });

  it("rejects an empty coveredProvinces list", () => {
    const parsed = mikroConfigSchema.safeParse({ ...base, applications: { coveredProvinces: [] } });
    expect(parsed.success).to.equal(false);
  });

  it("rejects a value that is not a province enum value", () => {
    const parsed = mikroConfigSchema.safeParse({
      ...base,
      applications: { coveredProvinces: ["Puerto Plata"] }
    });
    expect(parsed.success).to.equal(false);
  });

  it("accepts a list of province enum values", () => {
    const parsed = mikroConfigSchema.safeParse({
      ...base,
      applications: { coveredProvinces: ["PUERTO_PLATA", "SANTIAGO"], summaryModel: model }
    });
    expect(parsed.success).to.equal(true);
    if (parsed.success) {
      expect(parsed.data.applications.coveredProvinces).to.deep.equal(["PUERTO_PLATA", "SANTIAGO"]);
    }
  });
});

describe("mikroConfigSchema — accounting.disbursementAccounts", () => {
  const CAJA = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
  const RECAUDO = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2";
  const withAccounting = (accounting: unknown) =>
    mikroConfigSchema.safeParse({ ...minimalRequiredFields, accounting });

  it("is optional (only the default account is offered)", () => {
    const parsed = withAccounting({ disbursementAccountId: CAJA });
    expect(parsed.success).to.equal(true);
    expect(getDisbursementAccountOptions({ disbursementAccountId: CAJA })).to.deep.equal([
      { id: CAJA, name: null, isDefault: true }
    ]);
  });

  it("accepts a named list that contains the default, and lists the default first", () => {
    const accounting = {
      disbursementAccountId: RECAUDO,
      disbursementAccounts: [
        { id: CAJA, name: "Caja General" },
        { id: RECAUDO, name: "Cuenta de Recaudación" }
      ]
    };
    expect(withAccounting(accounting).success).to.equal(true);
    expect(getDisbursementAccountOptions(accounting)).to.deep.equal([
      { id: RECAUDO, name: "Cuenta de Recaudación", isDefault: true },
      { id: CAJA, name: "Caja General", isDefault: false }
    ]);
  });

  it("rejects a default that is not in the list", () => {
    const parsed = withAccounting({
      disbursementAccountId: CAJA,
      disbursementAccounts: [{ id: RECAUDO, name: "Cuenta de Recaudación" }]
    });
    expect(parsed.success).to.equal(false);
  });

  it("rejects duplicate ids, empty names and an empty list", () => {
    expect(
      withAccounting({
        disbursementAccountId: CAJA,
        disbursementAccounts: [
          { id: CAJA, name: "Caja General" },
          { id: CAJA, name: "Otra" }
        ]
      }).success
    ).to.equal(false);
    expect(
      withAccounting({
        disbursementAccountId: CAJA,
        disbursementAccounts: [{ id: CAJA, name: " " }]
      }).success
    ).to.equal(false);
    expect(
      withAccounting({ disbursementAccountId: CAJA, disbursementAccounts: [] }).success
    ).to.equal(false);
  });
});

describe("mikroConfigSchema — twilio", () => {
  const base = {
    ...minimalRequiredFields,
    accounting: { disbursementAccountId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1" }
  };

  it("is optional and defaults to empty (SMS off)", () => {
    const parsed = mikroConfigSchema.safeParse(base);
    expect(parsed.success).to.equal(true);
    if (parsed.success) {
      expect(parsed.data.twilio).to.deep.equal({
        accountSid: "",
        authToken: "",
        from: "",
        rejectionMessage: ""
      });
    }
  });

  it("accepts credentials and the rejection message", () => {
    const twilio = {
      accountSid: "AC123",
      authToken: "secret",
      from: "+18095550000",
      rejectionMessage: "Lo sentimos, su solicitud no fue aprobada."
    };
    const parsed = mikroConfigSchema.safeParse({ ...base, twilio });
    expect(parsed.success).to.equal(true);
    if (parsed.success) expect(parsed.data.twilio).to.deep.equal(twilio);
  });

  it("rejects unknown keys", () => {
    const parsed = mikroConfigSchema.safeParse({ ...base, twilio: { apiKey: "x" } });
    expect(parsed.success).to.equal(false);
  });
});

describe("mikroConfigSchema — classifier (openspec conversation-state)", () => {
  const base = {
    ...minimalRequiredFields,
    accounting: { disbursementAccountId: "6f1c7d1e-4b6a-4c8e-9f3a-2b1d5e7a9c10" }
  };

  const withClassifier = (classifier: unknown) => ({
    ...base,
    cx: { ...base.cx, classifier }
  });

  it("is optional: a config without it parses and has no classifier", () => {
    const parsed = mikroConfigSchema.safeParse(base);
    expect(parsed.success).to.equal(true);
    if (parsed.success) expect(parsed.data.cx.classifier).to.equal(undefined);
  });

  it("accepts the OpenAI Decisions provider and defaults its model", () => {
    const parsed = mikroConfigSchema.safeParse(
      withClassifier({ provider: "openai-decisions", apiKey: "k" })
    );
    expect(parsed.success).to.equal(true);
    if (parsed.success) expect(parsed.data.cx.classifier).to.deep.include({ model: "gpt-6-luna" });
  });

  it("accepts a chat model as the decision provider", () => {
    const parsed = mikroConfigSchema.safeParse(
      withClassifier({ provider: "chat", vendor: "openai", apiKey: "k", model: "gpt-4o-mini" })
    );
    expect(parsed.success).to.equal(true);
  });

  it("rejects unknown providers and unknown keys", () => {
    expect(
      mikroConfigSchema.safeParse(withClassifier({ provider: "jev", apiKey: "k" })).success
    ).to.equal(false);
    expect(
      mikroConfigSchema.safeParse(
        withClassifier({ provider: "openai-decisions", apiKey: "k", threshold: 0.5 })
      ).success
    ).to.equal(false);
  });
});

describe("mikroConfigSchema — evals", () => {
  const base = {
    ...minimalRequiredFields,
    accounting: { disbursementAccountId: "6f1c7d1e-4b6a-4c8e-9f3a-2b1d5e7a9c10" }
  };

  it("boots without evals: they are only needed to run agents:eval", () => {
    const parsed = mikroConfigSchema.safeParse(base);
    expect(parsed.success).to.equal(true);
    if (parsed.success) expect(parsed.data.evals).to.deep.equal({ candidates: {} });
  });

  it("accepts named candidates, visionModel optional", () => {
    const parsed = mikroConfigSchema.safeParse({
      ...base,
      evals: {
        model,
        classifier: { provider: "openai-decisions", apiKey: "k" },
        candidates: { claude: { model: { ...model, vendor: "anthropic" } } }
      }
    });
    expect(parsed.success).to.equal(true);
  });

  it("rejects unknown keys (the old vendors map)", () => {
    expect(mikroConfigSchema.safeParse({ ...base, evals: { vendors: {} } }).success).to.equal(
      false
    );
  });
});

describe("mikroConfigSchema — models per feature", () => {
  const base = {
    ...minimalRequiredFields,
    accounting: { disbursementAccountId: "6f1c7d1e-4b6a-4c8e-9f3a-2b1d5e7a9c10" }
  };

  it("rejects the old top-level llm and classifier sections", () => {
    expect(mikroConfigSchema.safeParse({ ...base, llm: { text: model } }).success).to.equal(false);
    expect(
      mikroConfigSchema.safeParse({
        ...base,
        classifier: { provider: "openai-decisions", apiKey: "k" }
      }).success
    ).to.equal(false);
  });

  for (const key of ["cx", "copilot", "reports"] as const) {
    it(`requires ${key}`, () => {
      const rest: Record<string, unknown> = { ...base };
      delete rest[key];
      expect(mikroConfigSchema.safeParse(rest).success).to.equal(false);
    });
  }

  it("requires applications.summaryModel", () => {
    const parsed = mikroConfigSchema.safeParse({
      ...base,
      applications: { coveredProvinces: ["PUERTO_PLATA"] }
    });
    expect(parsed.success).to.equal(false);
  });

  it("requires githubFeedback.model once its token is set", () => {
    const feedback = { token: "t", repo: "o/r" };
    expect(mikroConfigSchema.safeParse({ ...base, githubFeedback: feedback }).success).to.equal(
      false
    );
    expect(
      mikroConfigSchema.safeParse({ ...base, githubFeedback: { ...feedback, model } }).success
    ).to.equal(true);
  });

  it("requires conversationAudit.model when the scheduled audit is enabled", () => {
    expect(
      mikroConfigSchema.safeParse({ ...base, conversationAudit: { enabled: true } }).success
    ).to.equal(false);
    expect(
      mikroConfigSchema.safeParse({ ...base, conversationAudit: { enabled: true, model } }).success
    ).to.equal(true);
    expect(
      mikroConfigSchema.safeParse({ ...base, conversationAudit: { enabled: false } }).success
    ).to.equal(true);
  });
});

describe("mikroConfigSchema — loans.pricing", () => {
  const base = {
    ...minimalRequiredFields,
    accounting: { disbursementAccountId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1" }
  };

  function issuesOf(loans: unknown): string[] {
    const parsed = mikroConfigSchema.safeParse({ ...base, loans });
    expect(parsed.success).to.equal(false);
    return parsed.success
      ? []
      : parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  }

  it("defaults to 30% at 10 weeks, ±1.5% per week, 10%–60% when missing", () => {
    const defaults = {
      referenceRate: 0.3,
      referenceWeeks: 10,
      adjustmentPerWeek: 0.015,
      minRate: 0.1,
      maxRate: 0.6
    };
    for (const loans of [undefined, { defaultMoraRate: 0.1 }, { pricing: {} }]) {
      const parsed = mikroConfigSchema.safeParse({ ...base, loans });
      expect(parsed.success).to.equal(true);
      if (parsed.success) expect(parsed.data.loans.pricing).to.deep.equal(defaults);
    }
  });

  it("keeps the defaults for keys left out", () => {
    const parsed = mikroConfigSchema.safeParse({ ...base, loans: { pricing: { maxRate: 0.5 } } });
    expect(parsed.success).to.equal(true);
    if (parsed.success) {
      expect(parsed.data.loans.pricing.maxRate).to.equal(0.5);
      expect(parsed.data.loans.pricing.referenceRate).to.equal(0.3);
    }
  });

  it("rejects an unknown key inside pricing", () => {
    const issues = issuesOf({ pricing: { interestRate: 0.3 } });
    expect(issues.join("; ")).to.match(/^loans\.pricing: /);
  });

  it("rejects minRate > maxRate", () => {
    expect(issuesOf({ pricing: { minRate: 0.6, maxRate: 0.4, referenceRate: 0.5 } })).to.deep.equal(
      ["loans.pricing: minRate must be ≤ referenceRate ≤ maxRate (got 0.60, 0.50, 0.40)"]
    );
  });

  it("rejects a referenceRate outside minRate–maxRate", () => {
    expect(issuesOf({ pricing: { referenceRate: 0.7 } })).to.deep.equal([
      "loans.pricing: minRate must be ≤ referenceRate ≤ maxRate (got 0.10, 0.70, 0.60)"
    ]);
  });

  it("rejects a rate written as a percent and fractional weeks", () => {
    expect(issuesOf({ pricing: { referenceRate: 30 } })).to.deep.equal([
      "loans.pricing.referenceRate: must be a decimal between 0 and 1 (write 0.30 for 30%)"
    ]);
    expect(issuesOf({ pricing: { referenceWeeks: 10.5 } })).to.deep.equal([
      "loans.pricing.referenceWeeks: must be a whole number of weeks greater than 0"
    ]);
  });
});
