#!/usr/bin/env npx tsx
/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Script to verify the migration data integrity.
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../mods/apiserver/src/generated/prisma/client.js";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./mods/apiserver/data/dev.db"
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Migration Data Verification");
  console.log("==========================\n");

  // Count records
  const memberCount = await prisma.member.count();
  const loanCount = await prisma.loan.count();
  const paymentCount = await prisma.payment.count();
  const userCount = await prisma.user.count();

  console.log(`Users: ${userCount}`);
  console.log(`Members: ${memberCount}`);
  console.log(`Loans: ${loanCount}`);
  console.log(`Payments: ${paymentCount}\n`);

  // Check a few sample records
  if (memberCount > 0) {
    console.log("Sample Members:");
    const members = await prisma.member.findMany({ take: 3, include: { loans: true } });
    members.forEach(member => {
      console.log(`  - ${member.name} (${member.phone}) - Loans: ${member.loans.length}`);
    });
    console.log();
  }

  if (loanCount > 0) {
    console.log("Sample Loans:");
    const loans = await prisma.loan.findMany({
      take: 3,
      include: {
        member: { select: { name: true } },
        payments: true
      }
    });
    loans.forEach(loan => {
      console.log(`  - Loan ${loan.loanId}: ${loan.member.name} - Status: ${loan.status} - Payments: ${loan.payments.length}`);
    });
    console.log();
  }

  if (paymentCount > 0) {
    console.log("Sample Payments:");
    const payments = await prisma.payment.findMany({
      take: 3,
      include: {
        loan: {
          include: {
            member: { select: { name: true } }
          }
        }
      }
    });
    payments.forEach(payment => {
      console.log(`  - Payment: ${payment.amount} (${payment.method}) for ${payment.loan.member.name} on ${payment.paidAt.toISOString().split('T')[0]}`);
    });
  }

  console.log("\nVerification completed!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });