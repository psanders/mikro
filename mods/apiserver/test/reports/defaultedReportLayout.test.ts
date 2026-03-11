/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import {
  createDefaultedReportLayout,
  getDefaultedReportHeight,
  DEFAULTED_REPORT_WIDTH,
  type DefaultedReportRow
} from "@mikro/common";

function sampleRow(
  overrides: Partial<DefaultedReportRow> & { isDefaulted: boolean }
): DefaultedReportRow {
  return {
    name: "Jane Doe",
    phone: "+18091234567",
    loanId: 10001,
    nickname: "Jane",
    paymentFrequency: "WEEKLY",
    totalPaid: 1300,
    summary: "Sin notas",
    isDefaulted: true,
    ...overrides
  };
}

/** Recursively find a string in the layout tree (e.g. title or subtitle). */
function findTextInLayout(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap(findTextInLayout);
  if (node && typeof node === "object" && "props" in node) {
    const props = (node as { props: { children?: unknown } }).props;
    return props.children !== undefined ? findTextInLayout(props.children) : [];
  }
  return [];
}

describe("defaultedReportLayout", () => {
  describe("getDefaultedReportHeight", () => {
    it("should return at least 1200 for empty rows", () => {
      expect(getDefaultedReportHeight([])).to.equal(1200);
    });

    it("should increase height with more rows", () => {
      const few = getDefaultedReportHeight(
        Array.from({ length: 5 }, (_, i) => sampleRow({ isDefaulted: true, loanId: 10000 + i }))
      );
      const many = getDefaultedReportHeight(
        Array.from({ length: 30 }, (_, i) => sampleRow({ isDefaulted: true, loanId: 10000 + i }))
      );
      expect(many).to.be.greaterThan(few);
    });

    it("should increase height with longer summary (more wrapped lines)", () => {
      const short = getDefaultedReportHeight(
        Array.from({ length: 25 }, (_, i) =>
          sampleRow({ isDefaulted: true, loanId: 10000 + i, summary: "Short" })
        )
      );
      const long = getDefaultedReportHeight(
        Array.from({ length: 25 }, (_, i) =>
          sampleRow({
            isDefaulted: true,
            loanId: 10000 + i,
            summary: "A".repeat(200)
          })
        )
      );
      expect(long).to.be.greaterThan(short);
    });
  });

  describe("createDefaultedReportLayout", () => {
    it("should use at-risk report title and include default/atrasados in subtitle", () => {
      const rows: DefaultedReportRow[] = [
        sampleRow({ isDefaulted: true }),
        sampleRow({ isDefaulted: false })
      ];
      const layout = createDefaultedReportLayout(rows, 10000, "1 ene 2026");
      const texts = findTextInLayout(layout);
      expect(texts).to.include("Mikro Créditos — Reporte de Cartera en Riesgo");
      expect(
        texts.some(
          (t) => t.includes("en riesgo") && t.includes("1 default") && t.includes("1 atrasados")
        )
      ).to.be.true;
    });

    it("should show only defaulted count when all rows are defaulted", () => {
      const rows: DefaultedReportRow[] = [
        sampleRow({ isDefaulted: true }),
        sampleRow({ isDefaulted: true })
      ];
      const layout = createDefaultedReportLayout(rows, 15000, "1 ene 2026");
      const texts = findTextInLayout(layout);
      expect(texts.some((t) => t.includes("2 default") && t.includes("0 atrasados"))).to.be.true;
    });

    it("should show only atrasados count when no rows are defaulted", () => {
      const rows: DefaultedReportRow[] = [
        sampleRow({ isDefaulted: false }),
        sampleRow({ isDefaulted: false })
      ];
      const layout = createDefaultedReportLayout(rows, 8000, "1 ene 2026");
      const texts = findTextInLayout(layout);
      expect(texts.some((t) => t.includes("0 default") && t.includes("2 atrasados"))).to.be.true;
    });

    it("should render empty state when no rows", () => {
      const layout = createDefaultedReportLayout([], 0, "1 ene 2026");
      const texts = findTextInLayout(layout);
      expect(texts).to.include("No hay préstamos en riesgo.");
    });

    it("should have expected width constant", () => {
      expect(DEFAULTED_REPORT_WIDTH).to.equal(1200);
    });
  });
});
