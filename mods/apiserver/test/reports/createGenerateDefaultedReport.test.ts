/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Unit tests for createGenerateDefaultedReport. Filter/query behavior with mocked DB
 * would require stubbing ESM exports (renderDefaultedReportToPng, invokeTextPrompt)
 * and config (getLogoPath); full flow is better covered by integration tests.
 */
import { expect } from "chai";
import sinon from "sinon";

describe("createGenerateDefaultedReport", () => {
  let createGenerateDefaultedReport: (
    client: unknown
  ) => (params: { filter?: string }) => Promise<{ image: string }>;

  before(async () => {
    const mod = await import("../../src/api/reports/createGenerateDefaultedReport.js");
    createGenerateDefaultedReport = mod.createGenerateDefaultedReport;
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should throw ValidationError for invalid filter and not call findMany", async () => {
    const mockDb = { loan: { findMany: sinon.stub().resolves([]) } };
    const fn = createGenerateDefaultedReport(mockDb);

    try {
      await fn({ filter: "invalid" as "all" });
      expect.fail("Expected ValidationError");
    } catch (err: unknown) {
      const e = err as Error;
      expect(e.name).to.equal("ValidationError");
      expect(mockDb.loan.findMany.called).to.be.false;
    }
  });
});
