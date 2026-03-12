/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { generateCollectionsAuditReportSchema } from "@mikro/common";

describe("generateCollectionsAuditReportSchema", () => {
  it("should accept empty input (date defaults on server)", () => {
    const result = generateCollectionsAuditReportSchema.parse({});
    expect(result.date).to.be.undefined;
    expect(result.attemptTypes).to.be.undefined;
    expect(result.statuses).to.be.undefined;
  });

  it("should accept date as string and coerce to Date", () => {
    const result = generateCollectionsAuditReportSchema.parse({ date: "2026-03-12" });
    expect(result.date).to.be.instanceOf(Date);
    expect((result.date as Date).toISOString()).to.include("2026-03-12");
  });

  it("should accept attemptTypes filter", () => {
    const result = generateCollectionsAuditReportSchema.parse({
      attemptTypes: ["OVERDUE_NOTICE", "COLLECTION_CALL"]
    });
    expect(result.attemptTypes).to.deep.equal(["OVERDUE_NOTICE", "COLLECTION_CALL"]);
  });

  it("should accept statuses filter", () => {
    const result = generateCollectionsAuditReportSchema.parse({
      statuses: ["SENT", "FAILED"]
    });
    expect(result.statuses).to.deep.equal(["SENT", "FAILED"]);
  });

  it("should reject invalid attempt type", () => {
    expect(() =>
      generateCollectionsAuditReportSchema.parse({ attemptTypes: ["INVALID_TYPE"] })
    ).to.throw();
  });

  it("should reject invalid status", () => {
    expect(() => generateCollectionsAuditReportSchema.parse({ statuses: ["PENDING"] })).to.throw();
  });
});
