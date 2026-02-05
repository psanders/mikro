/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Generates an example members report (Excel) with sample data for manual inspection.
 * Run from repo root: npm run report:example (from mods/agents) or:
 *   npx tsx mods/agents/scripts/generateExampleReport.ts
 *
 * Output: reporte-ejemplo.xlsx in the current working directory.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateMembersExcel } from "../src/tools/executor/excelUtils.js";
import type { ExportedMember } from "../src/tools/executor/types.js";

const now = new Date();
const msPerWeek = 7 * 24 * 60 * 60 * 1000;
const start = new Date(now.getTime() - 6 * msPerWeek);
const pay = (weeksFromStart: number) => new Date(start.getTime() + weeksFromStart * msPerWeek);

const members: ExportedMember[] = [
  {
    name: "María Pérez (al día)",
    phone: "+18095551001",
    collectionPoint: "Punto A",
    notes: null,
    referredBy: { name: "Juan Referidor" },
    loans: [
      {
        loanId: 10001,
        notes: null,
        paymentFrequency: "WEEKLY",
        createdAt: start,
        termLength: 10,
        payments: [pay(1), pay(2), pay(3), pay(4), pay(5), pay(6)].map((paidAt) => ({ paidAt }))
      }
    ]
  },
  {
    name: "Carlos López (1 atrasado)",
    phone: "+18095551002",
    collectionPoint: "Punto B",
    notes: null,
    referredBy: { name: "Juan Referidor" },
    loans: [
      {
        loanId: 10002,
        notes: null,
        paymentFrequency: "WEEKLY",
        createdAt: start,
        termLength: 10,
        payments: [pay(1), pay(2), pay(3), pay(4), pay(5)].map((paidAt) => ({ paidAt }))
      }
    ]
  },
  {
    name: "Ana Martínez (2 atrasados)",
    phone: "+18095551003",
    collectionPoint: "Punto A",
    notes: null,
    referredBy: { name: "María Referidora" },
    loans: [
      {
        loanId: 10003,
        notes: null,
        paymentFrequency: "WEEKLY",
        createdAt: start,
        termLength: 10,
        payments: [pay(3), pay(4), pay(5), pay(6)].map((paidAt) => ({ paidAt }))
      }
    ]
  },
  {
    name: "Luis García (empeorando)",
    phone: "+18095551004",
    collectionPoint: "Punto C",
    notes: null,
    referredBy: { name: "Juan Referidor" },
    loans: [
      {
        loanId: 10004,
        notes: null,
        paymentFrequency: "WEEKLY",
        createdAt: start,
        termLength: 10,
        payments: [pay(1), pay(2), pay(3)].map((paidAt) => ({ paidAt }))
      }
    ]
  }
];

async function main() {
  const result = await generateMembersExcel(members, "reporte-ejemplo");
  const outPath = resolve(process.cwd(), result.filename);
  writeFileSync(outPath, result.buffer);
  console.log(`Report written: ${outPath}`);
  console.log(`Members: ${result.memberCount}, Loans: ${result.loanCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
