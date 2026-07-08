/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * accounting.disbursementAccountId must be a required, valid config field
 * (mikro/#155): the apiserver should refuse to boot without it rather than
 * fail later, silently, at the first loan conversion.
 */
import { expect } from "chai";
import { mikroConfigSchema } from "../src/config.js";

const minimalRequiredFields = {
  llm: {
    text: { vendor: "openai", apiKey: "k", model: "gpt-4o-mini" },
    vision: { vendor: "openai", apiKey: "k", model: "gpt-4o" },
    evals: { vendor: "openai", apiKey: "k", model: "gpt-4o-mini" }
  },
  whatsapp: {
    phoneNumberId: "123",
    accessToken: "token"
  }
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
