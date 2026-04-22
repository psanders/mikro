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
  getDueDateForCycle,
  MS_PER_DAY,
  type LoanPaymentData
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

function amountToNumber(amount: unknown): number {
  if (typeof amount === "number") return amount;
  if (amount && typeof amount === "object" && "toString" in amount) {
    return Number((amount as { toString: () => string }).toString());
  }
  return Number(amount);
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

function toLoanPaymentData(loan: {
  paymentFrequency: string;
  createdAt: Date;
  startingDate: Date | null;
  termLength: number;
  payments: Array<{ paidAt: Date; status: string }>;
  customer: { preferredPaymentDay: string | null };
}): LoanPaymentData {
  return {
    paymentFrequency: loan.paymentFrequency,
    createdAt: new Date(loan.createdAt),
    startingDate: loan.startingDate != null ? new Date(loan.startingDate) : null,
    termLength: loan.termLength,
    payments: loan.payments.map((p) => ({
      paidAt: new Date(p.paidAt),
      status: p.status
    })),
    preferredPaymentDay: loan.customer.preferredPaymentDay ?? null
  };
}

function diasAtraso(
  loanStart: Date,
  paymentFrequency: string,
  preferredPaymentDay: string | null,
  paymentsMade: number,
  missedCycles: number,
  asOf: Date
): number {
  if (missedCycles <= 0) return 0;
  const due = getDueDateForCycle(loanStart, paymentsMade, paymentFrequency, preferredPaymentDay);
  return Math.max(0, Math.floor((asOf.getTime() - due.getTime()) / MS_PER_DAY));
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

  try {
    const loans = await prisma.loan.findMany({
      where: { status: { in: EXPORTABLE_STATUSES } },
      include: {
        customer: {
          select: { name: true, idNumber: true, preferredPaymentDay: true }
        },
        payments: { select: { paidAt: true, status: true } }
      },
      orderBy: [{ customer: { name: "asc" } }, { loanId: "asc" }]
    });

    loans.sort((a, b) => displayNombre(a).localeCompare(displayNombre(b), "es"));

    const lines: string[] = [];
    lines.push(HEADERS.join(","));

    const moraRate = moraPct / 100;

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
      const dias = diasAtraso(
        loanStart,
        loan.paymentFrequency,
        loan.customer.preferredPaymentDay,
        paymentsMade,
        missedCycles,
        asOfDate
      );

      let interesPorc = "0%";
      if (principal > 0) {
        const totalPaid = montoCuota * termLength;
        const interesPct = Math.round(((totalPaid - principal) / principal) * 100);
        interesPorc = `${interesPct}%`;
      }

      const moraAmount = missedCycles > 0 ? moraRate * (dias / 30) * montoCuota : 0;
      const montoAtraso = montoCuota * missedCycles + moraAmount;

      const fechaPrestamo = formatLoanDateShort(loanStart);
      const freq = FREQ_LETTER[loan.paymentFrequency] ?? loan.paymentFrequency;

      const cells: (string | number)[] = [
        loan.customer.idNumber,
        displayNombre(loan),
        fechaPrestamo,
        principal.toFixed(2),
        interesPorc,
        `${Math.round(moraPct)}%`,
        termLength,
        montoCuota.toFixed(2),
        paymentsMade,
        cuotasPendientes,
        missedCycles,
        freq,
        dias,
        moraAmount.toFixed(2),
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
