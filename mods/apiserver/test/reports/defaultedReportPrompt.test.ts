/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import {
  buildLoanNotesSummaryPrompt,
  parseLoanNotesSummaryResponse,
  type NoteForSummary
} from "@mikro/common";

describe("defaultedReportPrompt", () => {
  describe("buildLoanNotesSummaryPrompt", () => {
    it("should format notes into a prompt with timestamps and authors", () => {
      const notes: NoteForSummary[] = [
        { content: "Called, no answer", createdAt: "2026-02-10T14:00:00Z", createdBy: "Ana" },
        { content: "Left voicemail", createdAt: "2026-02-11T09:30:00Z", createdBy: "Carlos" }
      ];

      const prompt = buildLoanNotesSummaryPrompt(notes);

      expect(prompt).to.include("- [2026-02-10T14:00:00Z] (Ana): Called, no answer");
      expect(prompt).to.include("- [2026-02-11T09:30:00Z] (Carlos): Left voicemail");
      expect(prompt).to.include("resumen");
    });

    it("should handle a single note", () => {
      const notes: NoteForSummary[] = [
        { content: "Prometió pagar", createdAt: "2026-02-15T10:00:00Z", createdBy: "Ana" }
      ];

      const prompt = buildLoanNotesSummaryPrompt(notes);

      expect(prompt).to.include("Prometió pagar");
      expect(prompt).to.be.a("string").with.length.greaterThan(0);
    });
  });

  describe("parseLoanNotesSummaryResponse", () => {
    it("should trim whitespace from response", () => {
      expect(parseLoanNotesSummaryResponse("  summary text  \n")).to.equal("summary text");
    });

    it("should return empty string for whitespace-only input", () => {
      expect(parseLoanNotesSummaryResponse("   \n  ")).to.equal("");
    });
  });
});
