/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Dominican phone parsing (issue #301): what people type normalizes to one
 * E.164 number, and impossible numbers are dropped instead of stored.
 */
import { expect } from "chai";
import { drPhoneDigits, isDrPhone } from "../../src/schemas/applicationForm.js";
import { applicationPayloadSchema, normalizeApplication } from "../../src/schemas/application.js";

const phoneOf = (phone: string) =>
  normalizeApplication(applicationPayloadSchema.parse({ sessionId: "s", phone })).phone;

describe("drPhoneDigits / isDrPhone", () => {
  it("accepts the formats people type", () => {
    for (const typed of [
      "8092345678",
      "809-234-5678",
      "(829) 871-7987",
      "1 849 234 5678",
      "+18092345678"
    ]) {
      expect(drPhoneDigits(typed), typed).to.match(/^(809|829|849)\d{7}$/);
    }
  });

  it("rejects numbers that can't be Dominican", () => {
    for (const typed of [
      "1809392630", // "1" typed first, then cut to 10 digits by the old form mask
      "+11809392630",
      "11849657395",
      "892222222",
      "7852264391", // US area code
      "+17852264391",
      "80923456789",
      ""
    ]) {
      expect(isDrPhone(typed), typed).to.be.false;
    }
  });

  it("is not fooled by non-strings", () => {
    expect(drPhoneDigits(undefined)).to.be.null;
    expect(drPhoneDigits(8092345678)).to.be.null;
  });
});

describe("normalizeApplication phone (issue #301)", () => {
  it("stores a Dominican number as E.164", () => {
    expect(phoneOf("(829) 871-7987")).to.equal("+18298717987");
    expect(phoneOf("1 809 234 5678")).to.equal("+18092345678");
  });

  it("stores null instead of an impossible +11… number", () => {
    expect(phoneOf("+11809392630")).to.be.null;
    expect(phoneOf("(180) 939-2630")).to.be.null;
  });

  it("keeps a WhatsApp sender's international number (Flow, José, re-saves)", () => {
    expect(phoneOf("+17852264391")).to.equal("+17852264391");
    expect(phoneOf("+34612345678")).to.equal("+34612345678");
  });

  it("still requires a Dominican number when typed without a country code", () => {
    expect(phoneOf("7852264391")).to.be.null;
    expect(phoneOf("+1 (180) 939-2630")).to.be.null;
  });
});
