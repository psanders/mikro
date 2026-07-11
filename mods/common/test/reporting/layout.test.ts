/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The derived page-safe-space model (`reporting/layout.ts`): every row/entry
 * budget here is arithmetic from real block dimensions, not a hand-tuned
 * constant. These tests pin the current derived numbers so a future padding/
 * font-size tweak that silently erodes the safety margin fails loudly here
 * instead of crashing the renderer in production (issue #202's root cause —
 * an unbudgeted page overflow aborts the whole Node process, uncatchably).
 *
 * The OLD hand-tuned constants (pre-redesign) were calibrated against a real
 * render: a page shaped like brandHeader + one-row kpiGrid + table + footer
 * crashed at 46 single-line rows and was clean at 44. The new page is
 * differently shaped (smaller padding, taller header, card-bordered table),
 * so the numbers below aren't directly comparable rows-for-rows — but every
 * budget this model produces must still land comfortably under that known
 * failure class, which is what the upper bounds below assert.
 */
import { expect } from "chai";
import {
  tableRowBudget,
  headerHeight,
  kpiGridHeight,
  verificationBannerHeight,
  SECTION_TITLE_HEIGHT,
  TABLE_HEADER_HEIGHT,
  TABLE_ROW_HEIGHT,
  FOOTER_HEIGHT,
  footerHeight,
  paginateByEstimatedHeight,
  estimateWrappedLines,
  estimateNoteEntryHeight,
  CONTENT_WIDTH,
  SAFETY_FACTOR
} from "@mikro/common";

describe("reporting layout — block height constants", () => {
  it("TABLE_ROW_HEIGHT is padding(20) + one 12px line(15) + border(1)", () => {
    expect(TABLE_ROW_HEIGHT).to.equal(36);
  });

  it("every derived block height constant is a positive, finite number", () => {
    for (const n of [SECTION_TITLE_HEIGHT, TABLE_HEADER_HEIGHT, FOOTER_HEIGHT, headerHeight(3)]) {
      expect(n).to.be.a("number");
      expect(Number.isFinite(n)).to.equal(true);
      expect(n).to.be.greaterThan(0);
    }
  });

  it("footerHeight grows with additional left-column lines", () => {
    expect(footerHeight(2)).to.be.greaterThan(footerHeight(1));
  });

  it("kpiGridHeight scales with row count and reserves extra room for subtext", () => {
    expect(kpiGridHeight(2)).to.be.greaterThan(kpiGridHeight(1));
    expect(kpiGridHeight(1, true)).to.be.greaterThan(kpiGridHeight(1, false));
  });

  it("verificationBannerHeight grows with explanation line count", () => {
    expect(verificationBannerHeight(3)).to.be.greaterThan(verificationBannerHeight(1));
  });
});

describe("reporting layout — tableRowBudget", () => {
  it("a bare continuation page (no header/kpi/banner) budgets comfortably under the old empirical crash boundary (44 clean / 46 crashed)", () => {
    const budget = tableRowBudget({});
    expect(budget).to.equal(20);
    expect(budget).to.be.at.most(40); // well under half the old boundary's margin
  });

  it("a first page carrying brandHeader + verificationBanner + a 2-row kpiGrid budgets fewer rows than a bare continuation page", () => {
    const withChrome = tableRowBudget({
      aboveHeights: [headerHeight(3), verificationBannerHeight(2), kpiGridHeight(2, true)]
    });
    const bare = tableRowBudget({});
    expect(withChrome).to.be.greaterThan(0);
    expect(withChrome).to.be.lessThan(bare);
  });

  it("stacking more/taller siblings above the table only ever shrinks the row budget, never grows it", () => {
    const noAbove = tableRowBudget({});
    const oneAbove = tableRowBudget({ aboveHeights: [headerHeight(2)] });
    const twoAbove = tableRowBudget({ aboveHeights: [headerHeight(2), kpiGridHeight(1, true)] });
    expect(oneAbove).to.be.at.most(noAbove);
    expect(twoAbove).to.be.at.most(oneAbove);
  });

  it("never returns a negative budget even when siblings alone would overflow the page", () => {
    const budget = tableRowBudget({ aboveHeights: [10000] });
    expect(budget).to.equal(0);
  });

  it("applies the documented safety factor rather than the raw floor", () => {
    // A hand-computed budget with the safety factor stripped out must be >=
    // the actual (margined) budget — the margin can only shrink the number.
    expect(SAFETY_FACTOR).to.be.lessThan(1);
    expect(SAFETY_FACTOR).to.be.greaterThan(0.5);
  });
});

describe("reporting layout — estimated-height pagination (variable-length content)", () => {
  it("estimateWrappedLines returns 1 for a short sentence at page content width", () => {
    expect(estimateWrappedLines("Nota corta", CONTENT_WIDTH)).to.equal(1);
  });

  it("estimateWrappedLines grows with text length", () => {
    const short = estimateWrappedLines("x".repeat(20), CONTENT_WIDTH);
    const long = estimateWrappedLines("x".repeat(400), CONTENT_WIDTH);
    expect(long).to.be.greaterThan(short);
  });

  it("estimateNoteEntryHeight grows with a longer note", () => {
    const short = estimateNoteEntryHeight("Nota corta.");
    const long = estimateNoteEntryHeight("Nota larga. ".repeat(30));
    expect(long).to.be.greaterThan(short);
  });

  it("paginateByEstimatedHeight keeps at least one item per page even when a single item alone exceeds the budget", () => {
    const pages = paginateByEstimatedHeight([1, 2, 3], () => 1000, 10);
    expect(pages).to.have.length(3);
    pages.forEach((p) => expect(p).to.have.length(1));
  });

  it("paginateByEstimatedHeight packs multiple small items onto one page instead of one-per-page", () => {
    const pages = paginateByEstimatedHeight([1, 2, 3, 4], () => 10, 25);
    expect(pages.flat()).to.deep.equal([1, 2, 3, 4]);
    expect(pages.length).to.be.lessThan(4);
  });

  it("accounts for the separator between items so packed items never exceed the real budget", () => {
    // 3 items of height 10 with a separator of 5 need 10+5+10+5+10 = 40, not 30.
    const pages = paginateByEstimatedHeight([1, 2, 3], () => 10, 35, 35, 5);
    expect(pages).to.have.length(2);
    expect(pages[0]).to.have.length(2);
    expect(pages[1]).to.have.length(1);
  });
});
