#!/usr/bin/env npx tsx
/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Lending cash-on-hand (loan book only): sum of eligible payments minus sum of
 * loan principal for non-cancelled loans. Implied position from DB rows; not
 * bank reconciliation — see ACCOUNTING.md at repo root.
 *
 * Defaults:
 *   - Principal: all loans except status CANCELLED (matches portfolio metrics).
 *   - Payments: COMPLETED and PARTIAL only (excludes PENDING, REVERSED).
 *
 * Run from repo root: npm run lending:cash-position
 *
 * Optional extension (not implemented): --include-cancelled-principal
 *
 * Interpreting totals: "Total principal" is the sum of each loan's principal
 * field (one row per loan, unique loan_id). It includes COMPLETED and DEFAULTED
 * loans—that is lifetime capital recorded on the book, not the same peso
 * counted twice. Compare "ACTIVE only" principal if you care about capital
 * currently marked active.
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { config as loadDotenv } from "dotenv";
import { getConfig } from "@mikro/common";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import {
  LoanStatus,
  PaymentStatus,
  PrismaClient
} from "../mods/apiserver/src/generated/prisma/client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");
loadDotenv({ path: resolve(ROOT_DIR, ".env") });
if (!process.env.MIKRO_CONFIG_FILE) {
  process.env.MIKRO_CONFIG_FILE = resolve(ROOT_DIR, "mikro.json");
}

function decimalToNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "toString" in v) {
    return Number((v as { toString: () => string }).toString());
  }
  return Number(v);
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      help: { type: "boolean", short: "h", default: false },
      detail: { type: "boolean", default: false }
    },
    strict: true,
    allowPositionals: false
  });

  if (values.help) {
    console.log(`Usage: npm run lending:cash-position -- [options]

Prints cumulative payments received (COMPLETED + PARTIAL) minus total principal
on loans that are not CANCELLED. Uses the database from MIKRO_CONFIG_FILE / getConfig().

Options:
  -h, --help      Show this help
  --detail        Principal and payments broken down by status; duplicate check
`);
    return;
  }

  const adapter = new PrismaBetterSqlite3({
    url: getConfig().databaseUrl
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const [loanAgg, payAgg] = await Promise.all([
      prisma.loan.aggregate({
        where: { status: { not: LoanStatus.CANCELLED } },
        _sum: { principal: true },
        _count: true
      }),
      prisma.payment.aggregate({
        where: {
          status: { in: [PaymentStatus.COMPLETED, PaymentStatus.PARTIAL] }
        },
        _sum: { amount: true },
        _count: true
      })
    ]);

    const totalPrincipal = decimalToNumber(loanAgg._sum.principal);
    const totalPayments = decimalToNumber(payAgg._sum.amount);
    const net = totalPayments - totalPrincipal;
    const loanCount = loanAgg._count;
    const paymentCount = payAgg._count;

    const activePrincipalAgg = await prisma.loan.aggregate({
      where: { status: LoanStatus.ACTIVE },
      _sum: { principal: true },
      _count: true
    });
    const activePrincipalOnly = decimalToNumber(activePrincipalAgg._sum.principal);
    const activeLoanCount = activePrincipalAgg._count;

    console.log("Lending cash position (loan tables only)");
    console.log("─".repeat(48));
    console.log(`Loans counted (non-CANCELLED):     ${loanCount}`);
    console.log(`Total principal disbursed:        ${formatMoney(totalPrincipal)}`);
    console.log(
      `  (ACTIVE loans only: ${activeLoanCount} loans, ${formatMoney(activePrincipalOnly)} principal)`
    );
    console.log(`Payments counted (COMPLETED+PARTIAL): ${paymentCount}`);
    console.log(`Total payments received:          ${formatMoney(totalPayments)}`);
    console.log(`Net (payments − principal):       ${formatMoney(net)}`);
    console.log("─".repeat(48));
    console.log(
      "Note: Total principal sums every non-CANCELLED loan once (no duplicate loan_id). " +
        "It still includes completed/defaulted loans—lifetime booked lending, not only your first wallet deposit."
    );

    if (values.detail) {
      const loanRows = await prisma.loan.groupBy({
        by: ["status"],
        _sum: { principal: true },
        _count: true
      });
      const payRows = await prisma.payment.groupBy({
        by: ["status"],
        _sum: { amount: true },
        _count: true
      });
      const allLoans = await prisma.loan.count();
      const distinctLoanIds = (
        await prisma.loan.findMany({ select: { loanId: true }, distinct: ["loanId"] })
      ).length;

      console.log("\nDetail — principal by loan status (all loans):");
      for (const row of loanRows.sort((a, b) => String(a.status).localeCompare(String(b.status)))) {
        const p = decimalToNumber(row._sum.principal);
        console.log(
          `  ${String(row.status).padEnd(12)} ${String(row._count).padStart(4)} loans   ${formatMoney(p)}`
        );
      }
      console.log("\nDetail — payments by status:");
      for (const row of payRows.sort((a, b) => String(a.status).localeCompare(String(b.status)))) {
        const a = decimalToNumber(row._sum.amount);
        const tag =
          row.status === PaymentStatus.COMPLETED || row.status === PaymentStatus.PARTIAL
            ? " (in net)"
            : " (excluded from net)";
        console.log(
          `  ${String(row.status).padEnd(12)} ${String(row._count).padStart(4)} rows   ${formatMoney(a)}${tag}`
        );
      }
      console.log("\nSanity: loan rows vs distinct loan_id:");
      console.log(
        `  rows: ${allLoans}   distinct loan_id: ${distinctLoanIds}   match: ${allLoans === distinctLoanIds}`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
