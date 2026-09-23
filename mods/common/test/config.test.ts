/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * accounting.disbursementAccountId must be a required, valid config field
 * (mikro/#155): the apiserver should refuse to boot without it rather than
 * fail later, silently, at the first loan conversion.
 */
import { expect } from "chai";
import { mikroConfigSchema, getDisbursementAccountOptions } from "../src/config.js";

const minimalRequiredFields = {
  llm: {
    text: { vendor: "openai", apiKey: "k", model: "gpt-4o-mini" },
    vision: { vendor: "openai", apiKey: "k", model: "gpt-4o" },
    evals: { vendor: "openai", apiKey: "k", model: "gpt-4o-mini" }
  },
  whatsapp: {
    phoneNumberId: "123",
    accessToken: "token"
  },
  applications: { coveredProvinces: ["PUERTO_PLATA"] }
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
      applications: { coveredProvinces: ["PUERTO_PLATA", "SANTIAGO"] }
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
