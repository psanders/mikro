#!/usr/bin/env node
/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Renders every report (both a realistic small sample and a pathologically
 * large variant, to exercise the pagination/height model) to per-page PNGs
 * for visual QA against the Pencil reference screenshots — the fastest way
 * to compare the actual satori/resvg output pixel-for-pixel against the
 * design without opening a PDF viewer for every iteration.
 *
 * Usage:
 *   npm run build -w mods/common   # this script imports the built dist/
 *   node mods/common/scripts/render-samples.mjs [outputDir]
 *
 * `outputDir` defaults to a directory OUTSIDE the repo (a temp dir) so
 * nothing here needs a `.gitignore` entry — pass an explicit path to keep
 * the output somewhere else.
 */
/* global process, console */
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const outputDir = process.argv[2] ?? join(tmpdir(), "mikro-report-samples");

const { renderReportToPngs } = await import(
  pathToFileURL(join(here, "..", "dist", "index.js")).href
);

/** Load local Geist TTFs and label them "Inter" so satori matches fontFamily — same trick as the reporting tests, keeps this offline. */
function loadLocalFonts() {
  const base = require
    .resolve("@expo-google-fonts/geist/package.json")
    .replace(/package\.json$/, "");
  const read = (rel) => {
    const buf = readFileSync(join(base, rel));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  };
  return [
    { name: "Inter", data: read("400Regular/Geist_400Regular.ttf"), weight: 400, style: "normal" },
    { name: "Inter", data: read("500Medium/Geist_500Medium.ttf"), weight: 500, style: "normal" },
    {
      name: "Inter",
      data: read("600SemiBold/Geist_600SemiBold.ttf"),
      weight: 600,
      style: "normal"
    },
    { name: "Inter", data: read("700Bold/Geist_700Bold.ttf"), weight: 700, style: "normal" },
    { name: "Inter", data: read("900Black/Geist_900Black.ttf"), weight: 900, style: "normal" }
  ];
}

const injectedFonts = loadLocalFonts();
const testDeps = { loadFonts: async () => injectedFonts };

import {
  loanStatementFixture,
  defaultedFixture,
  customersFixture,
  renewalFixture,
  accountingFixture,
  performanceFixture
} from "./sampleFixtures.mjs";

// ==================== Render + write ====================

async function writePages(name, docBuilder, data) {
  const doc = docBuilder(data);
  const pngs = await renderReportToPngs(doc, testDeps);
  await Promise.all(pngs.map((png, i) => writeFile(join(outputDir, `${name}-p${i + 1}.png`), png)));
  console.log(`${name}: ${pngs.length} page(s)`);
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  const { buildLoanStatementData, buildLoanStatementDocument } = await import(
    pathToFileURL(join(here, "..", "dist", "reporting", "loanStatement.js")).href
  );
  const { buildDefaultedReportData, buildDefaultedReportDocument } = await import(
    pathToFileURL(join(here, "..", "dist", "reporting", "defaultedReport.js")).href
  );
  const { buildCustomersReportData, buildCustomersReportDocument } = await import(
    pathToFileURL(join(here, "..", "dist", "reporting", "customersReport.js")).href
  );
  const { buildRenewalReportData, buildRenewalReportDocument } = await import(
    pathToFileURL(join(here, "..", "dist", "reporting", "renewalReport.js")).href
  );
  const { buildAccountingReportData, buildAccountingReportDocument } = await import(
    pathToFileURL(join(here, "..", "dist", "reporting", "accountingReport.js")).href
  );
  const { buildPerformanceReportData, buildPerformanceReportDocument } = await import(
    pathToFileURL(join(here, "..", "dist", "reporting", "performanceReport.js")).href
  );

  await writePages(
    "loan-statement",
    (input) => buildLoanStatementDocument(buildLoanStatementData(input)),
    loanStatementFixture({ termLength: 13, frequency: "WEEKLY" })
  );
  await writePages(
    "loan-statement-large",
    (input) => buildLoanStatementDocument(buildLoanStatementData(input)),
    loanStatementFixture({ termLength: 40, frequency: "DAILY" })
  );

  await writePages(
    "defaulted",
    (input) => buildDefaultedReportDocument(buildDefaultedReportData(input)),
    defaultedFixture(5)
  );
  await writePages(
    "defaulted-large",
    (input) => buildDefaultedReportDocument(buildDefaultedReportData(input)),
    defaultedFixture(30)
  );

  await writePages(
    "customers",
    (input) => buildCustomersReportDocument(buildCustomersReportData(input)),
    customersFixture(6)
  );
  await writePages(
    "customers-large",
    (input) => buildCustomersReportDocument(buildCustomersReportData(input)),
    customersFixture(90)
  );

  await writePages(
    "renewal",
    (input) => buildRenewalReportDocument(buildRenewalReportData(input)),
    renewalFixture(5)
  );

  await writePages(
    "accounting",
    (input) => buildAccountingReportDocument(buildAccountingReportData(input)),
    accountingFixture(5)
  );
  await writePages(
    "accounting-large",
    (input) => buildAccountingReportDocument(buildAccountingReportData(input)),
    accountingFixture(60)
  );

  await writePages(
    "performance",
    (input) => buildPerformanceReportDocument(buildPerformanceReportData(input)),
    performanceFixture()
  );

  console.log(`\nWrote samples to ${outputDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
