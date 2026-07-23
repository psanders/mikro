#!/usr/bin/env npx tsx
/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Smoke test for the performance-trend report ("Desempeño en el Tiempo").
 * Connects to the on-disk mikro.db (a copy of production), runs the real
 * `createGeneratePerformanceTrend` data pipeline against it, and writes both
 * the branded PDF and the canonical JSON to a temp dir for inspection.
 *
 * Prereq: `npm run build -w mods/common` (the report renderer + definition are
 * imported from @mikro/common's built dist).
 *
 * Run from repo root: npm run smoke:trend
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { config as loadDotenv } from "dotenv";
import { getResolvedDatabaseUrl, type DbClient } from "@mikro/common";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");
loadDotenv({ path: resolve(ROOT_DIR, ".env") });
if (!process.env.MIKRO_CONFIG_FILE) {
  process.env.MIKRO_CONFIG_FILE = resolve(ROOT_DIR, "mikro.json");
}

const require = createRequire(import.meta.url);
const { PrismaClient } = await import("../mods/apiserver/src/generated/prisma/client.js");
const { createGeneratePerformanceTrend } =
  await import("../mods/apiserver/src/api/reports/createGeneratePerformanceTrend.js");

/**
 * Load local Geist TTFs labelled "Inter" so satori matches `fontFamily: Inter`
 * without a network fetch (same trick the reporting tests + render-samples use).
 * Falls back to the renderer's default (gstatic) loader if the package is absent.
 */
function offlineFonts() {
  try {
    const base = require
      .resolve("@expo-google-fonts/geist/package.json")
      .replace(/package\.json$/, "");
    const read = (rel: string) => {
      const buf = readFileSync(join(base, rel));
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    };
    return [
      {
        name: "Inter",
        data: read("400Regular/Geist_400Regular.ttf"),
        weight: 400,
        style: "normal"
      },
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
  } catch {
    return null;
  }
}

/**
 * Which SQLite file to read. Defaults to the app's configured db
 * (`mikro.json` → `databaseUrl`, i.e. `mods/apiserver/data/mikro.db`), but a
 * path passed as an argument or via `MIKRO_DB` overrides it — e.g. to point at
 * a freshly downloaded copy at the repo root: `npm run smoke:trend -- mikro.db`.
 */
function resolveDbUrl(): string {
  const override = process.env.MIKRO_DB ?? process.argv[2];
  return override ? `file:${resolve(ROOT_DIR, override)}` : getResolvedDatabaseUrl();
}

async function main() {
  const dbUrl = resolveDbUrl();
  console.log(`DB: ${dbUrl}`);
  const adapter = new PrismaBetterSqlite3({ url: dbUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    const fonts = offlineFonts();
    const renderDeps = fonts ? { loadFonts: async () => fonts as never } : undefined;

    const generate = createGeneratePerformanceTrend(prisma as unknown as DbClient, { renderDeps });
    const result = await generate({ endDate: new Date(), months: 12, format: "pdf" });

    const outDir = join(tmpdir(), "mikro-desempeno-tiempo");
    mkdirSync(outDir, { recursive: true });
    const pdfPath = join(outDir, result.filename);
    const jsonPath = pdfPath.replace(/\.pdf$/, ".json");

    writeFileSync(pdfPath, Buffer.from(result.pdfBase64!, "base64"));
    writeFileSync(jsonPath, JSON.stringify(result.data, null, 2));

    const d = result.data;
    const actual = d.months.filter((m) => !m.projected);
    const projected = d.months.filter((m) => m.projected);
    const be = d.breakeven.profitPositive;
    const k = d.kpis;

    console.log("Performance-trend smoke — OK");
    console.log(`  Período:            ${d.period.startDate} → ${d.period.endDate}`);
    console.log(`  Meses:              ${actual.length} reales + ${projected.length} proyectados`);
    console.log(
      `  Ganancia del mes:   RD$${k.operatingProfitDop.toLocaleString("en-US")} (Δ ${k.operatingProfitDeltaDop >= 0 ? "+" : ""}${k.operatingProfitDeltaDop.toLocaleString("en-US")} vs. mes ant.)`
    );
    console.log(
      `  Cobro del mes:      ${k.collectionRatePct.toFixed(0)}%  ·  Mora: ${k.defaultRatePct.toFixed(1)}%  ·  PAR30: ${k.parPct.toFixed(0)}%`
    );
    console.log(
      `  Empiezan a ganar:   ${be ? `${be.label}${be.projected ? " (proyectado)" : ""}` : "sin cruce en horizonte"}`
    );
    console.log(
      `\n  PDF:  ${pdfPath} (${Math.round((result.pdfBase64!.length * 0.75) / 1024)} KB)`
    );
    console.log(`  JSON: ${jsonPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
