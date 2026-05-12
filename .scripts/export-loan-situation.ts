#!/usr/bin/env npx tsx
/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Export loan situation CSV (Spanish column headers, FORMATO_SITUACION_PRESTAMOS): one row per loan.
 * Only ACTIVE and DEFAULTED loans (COMPLETED and CANCELLED are excluded).
 * Run from repo root: npm run export:loan-situation
 *
 * Options:
 *   --mora <number>      Monthly late-fee rate as a percent (default: 10)
 *   --as-of YYYY-MM-DD   As-of date for cycle/arrears (default: today local end of day)
 *   -o, --output PATH    Output CSV (default: loan-situation-YYYY-MM-DD.csv in cwd)
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { config as loadDotenv } from "dotenv";
import {
  getConfig,
  getCycleMetrics,
  computeAccruedMora,
  amountToNumber,
  toLoanPaymentData
} from "@mikro/common";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { LoanStatus, PrismaClient } from "../mods/apiserver/src/generated/prisma/client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");
loadDotenv({ path: resolve(ROOT_DIR, ".env") });
if (!process.env.MIKRO_CONFIG_FILE) {
  process.env.MIKRO_CONFIG_FILE = resolve(ROOT_DIR, "mikro.json");
}

const HEADERS = [
  "CEDULA",
  "NOMBRE",
  "FECHA_PRESTAMO",
  "MONTO_PRESTAMO",
  "INTERES_PORC",
  "MORA_PORC",
  "CANT_CUOTAS",
  "MONTO_CUOTA",
  "CUOTAS_PAGAS",
  "CUOTAS_PENDIENTES",
  "CUOTAS_ATRASOS",
  "FREQ_PAGO",
  "DIAS_ATRASO",
  "MORA",
  "MORA_COBRADA",
  "MONTO_ATRASO"
] as const;

/** Only these statuses are exported. */
const EXPORTABLE_STATUSES: LoanStatus[] = [LoanStatus.ACTIVE, LoanStatus.DEFAULTED];

const FREQ_LETTER: Record<string, string> = {
  DAILY: "D",
  WEEKLY: "S",
  BIWEEKLY: "Q",
  MONTHLY: "M"
};

function parseLocalDate(isoDate: string, endOfDay: boolean): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) {
    throw new Error(`Invalid date "${isoDate}". Use YYYY-MM-DD.`);
  }
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  if (endOfDay) {
    return new Date(y, mo, d, 23, 59, 59, 999);
  }
  return new Date(y, mo, d, 0, 0, 0, 0);
}

function formatAsOfForFilename(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatLoanDateShort(d: Date): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ];
  const day = String(d.getDate()).padStart(2, "0");
  const mon = months[d.getMonth()] ?? "Jan";
  const yy = String(d.getFullYear()).slice(-2);
  return `${day}-${mon}-${yy}`;
}

function csvEscape(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\r") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowToCsvLine(cells: (string | number | boolean)[]): string {
  return cells
    .map((c) => {
      if (c === "" || c === null || c === undefined) return "";
      if (typeof c === "boolean") return c ? "true" : "false";
      if (typeof c === "number") return Number.isFinite(c) ? String(c) : "";
      return csvEscape(c);
    })
    .join(",");
}

function displayNombre(loan: { nickname: string | null; customer: { name: string } }): string {
  const nick = loan.nickname?.trim();
  return nick && nick.length > 0 ? nick : loan.customer.name;
}

function moraCollectedDop(
  payments: Array<{ paidAt: Date; status: string; kind?: string | null; amount: unknown }>,
  asOf: Date
): number {
  let sum = 0;
  for (const p of payments) {
    if (p.kind !== "LATE_FEE" || p.status !== "COMPLETED") continue;
    if (new Date(p.paidAt) > asOf) continue;
    sum += amountToNumber(p.amount);
  }
  return Number(sum.toFixed(2));
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      mora: { type: "string" },
      "as-of": { type: "string" },
      output: { type: "string", short: "o" },
      help: { type: "boolean", short: "h", default: false }
    },
    strict: true,
    allowPositionals: false
  });

  if (values.help) {
    console.log(`Usage: npm run export:loan-situation -- [options]

Options:
  --mora <number>      Monthly late-fee rate as a percent (default: 10)
  --as-of YYYY-MM-DD   As-of date for cycle/arrears (default: today local end of day)
  -o, --output PATH    Output CSV (default: loan-situation-YYYY-MM-DD.csv in cwd)
  -h, --help           Show this help
`);
    return;
  }

  const moraPct = values.mora != null && values.mora !== "" ? Number(values.mora) : 10;
  if (!Number.isFinite(moraPct) || moraPct < 0) {
    console.error("Error: --mora must be a non-negative number.");
    process.exit(1);
  }

  const asOfDate = values["as-of"]
    ? parseLocalDate(values["as-of"], true)
    : parseLocalDate(formatAsOfForFilename(new Date()), true);

  const defaultOut = `loan-situation-${formatAsOfForFilename(asOfDate)}.csv`;
  const outputPath = values.output ?? defaultOut;

  const adapter = new PrismaBetterSqlite3({
    url: getConfig().databaseUrl
  });
  const prisma = new PrismaClient({ adapter });
  const cfg = getConfig();

  try {
    const loans = await prisma.loan.findMany({
      where: { status: { in: EXPORTABLE_STATUSES } },
      include: {
        customer: {
          select: { name: true, idNumber: true, preferredPaymentDay: true }
        },
        payments: { select: { paidAt: true, status: true, kind: true, amount: true } }
      },
      orderBy: [{ customer: { name: "asc" } }, { loanId: "asc" }]
    });

    loans.sort((a, b) => displayNombre(a).localeCompare(displayNombre(b), "es"));

    const lines: string[] = [];
    lines.push(HEADERS.join(","));

    for (const loan of loans) {
      const principal = amountToNumber(loan.principal);
      const montoCuota = amountToNumber(loan.paymentAmount);
      const termLength = loan.termLength;

      const loanData = toLoanPaymentData({
        paymentFrequency: loan.paymentFrequency,
        createdAt: loan.createdAt,
        startingDate: loan.startingDate,
        termLength: loan.termLength,
        payments: loan.payments,
        customer: loan.customer
      });

      const { paymentsMade, missedCycles } = getCycleMetrics(loanData, asOfDate);
      const cuotasPendientes = Math.max(0, termLength - paymentsMade);
      const loanStart = new Date(loan.startingDate ?? loan.createdAt);
      const resolvedMoraRate =
        loan.moraRate != null ? amountToNumber(loan.moraRate) : cfg.loans.defaultMoraRate;

      let interesPorc = "0%";
      if (principal > 0) {
        const totalPaid = montoCuota * termLength;
        const interesPct = Math.round(((totalPaid - principal) / principal) * 100);
        interesPorc = `${interesPct}%`;
      }

      const accrued = computeAccruedMora({
        loanData,
        moraRate: resolvedMoraRate,
        paymentAmount: montoCuota,
        paymentFrequency: loan.paymentFrequency,
        preferredPaymentDay: loan.customer.preferredPaymentDay ?? null,
        loanStart,
        asOfDate,
        loanStatus: loan.status,
        loanUpdatedAt: new Date(loan.updatedAt),
        policy: cfg.loans
      });
      const moraAmount = accrued.moraAmount;
      const dias = accrued.daysLate;
      const moraCollected = moraCollectedDop(loan.payments, asOfDate);
      const montoAtraso = montoCuota * missedCycles + moraAmount;

      const fechaPrestamo = formatLoanDateShort(loanStart);
      const freq = FREQ_LETTER[loan.paymentFrequency] ?? loan.paymentFrequency;

      const cells: (string | number)[] = [
        loan.customer.idNumber,
        displayNombre(loan),
        fechaPrestamo,
        principal.toFixed(2),
        interesPorc,
        `${Math.round(resolvedMoraRate * 100)}%`,
        termLength,
        montoCuota.toFixed(2),
        paymentsMade,
        cuotasPendientes,
        missedCycles,
        freq,
        dias,
        moraAmount.toFixed(2),
        moraCollected.toFixed(2),
        montoAtraso.toFixed(2)
      ];

      lines.push(rowToCsvLine(cells));
    }

    writeFileSync(outputPath, lines.join("\n"), "utf8");
    console.log(
      `Wrote ${loans.length} row(s) to ${resolve(process.cwd(), outputPath)} (as of ${formatAsOfForFilename(asOfDate)})`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
