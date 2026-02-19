/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { generateDefaultedReportSchema } from "@mikro/common";

describe("generateDefaultedReportSchema", () => {
  it("should default filter to 'all' when omitted", () => {
    const result = generateDefaultedReportSchema.parse({});
    expect(result.filter).to.equal("all");
  });

  it("should accept filter 'all'", () => {
    const result = generateDefaultedReportSchema.parse({ filter: "all" });
    expect(result.filter).to.equal("all");
  });

  it("should accept filter 'defaulted'", () => {
    const result = generateDefaultedReportSchema.parse({ filter: "defaulted" });
    expect(result.filter).to.equal("defaulted");
  });

  it("should accept filter 'late'", () => {
    const result = generateDefaultedReportSchema.parse({ filter: "late" });
    expect(result.filter).to.equal("late");
  });

  it("should reject invalid filter value", () => {
    expect(() => generateDefaultedReportSchema.parse({ filter: "invalid" })).to.throw();
  });
});
