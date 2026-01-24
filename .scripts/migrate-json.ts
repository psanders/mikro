#!/usr/bin/env npx tsx
/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Script to migrate data from migration-data.json into the database.
 * Run with: npm run migrate:json
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../mods/apiserver/src/generated/prisma/client.js";
import { validateDominicanPhone } from "../mods/common/src/utils/validatePhone.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./mods/apiserver/data/dev.db"
});

const prisma = new PrismaClient({ adapter });

// Migration data interfaces
interface PaymentData {
  method: "CASH" | "TRANSFER";
  amount: number;
  createdAt: string;
}

interface LoanData {
  loanId: number;
  type: "SAN";
  status: "ACTIVE" | "COMPLETED" | "DEFAULTED" | "CANCELLED";
  principal: number;
  termLength: number;
  paymentAmount: number;
  paymentFrequency: "DAILY" | "WEEKLY";
  payments: PaymentData[];
}

interface MemberData {
  name: string;
  phone: string;
  idNumber: string;
  collectionPoint: string;
  homeAddress: string;
  jobPosition: string | null;
  income: number | null;
  isBusinessOwner: boolean;
  idCardOnRecord: boolean;
  isActive: boolean;
  referredById: string;
  assignedCollectorId: string;
  createdAt: string;
  loan?: LoanData;
}

// Statistics interface
interface MigrationStats {
  total: number;
  membersCreated: number;
  membersSkipped: number;
  loansCreated: number;
  loansSkipped: number;
  paymentsCreated: number;
  paymentsSkipped: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * Validate that all required users exist in the database
 */
async function validateRequiredUsers(): Promise<Map<string, boolean>> {
  const requiredUserIds = [
    "7a8bbcaa-063d-4fce-ae02-da9356dac213", // Pedro Sanders (ADMIN)
    "6ce9e266-b2fb-4dce-b21b-d0842fd78b36", // Isaic Santos (Referrer)
    "3757f991-57b3-4163-a8b5-387b97fa7dfe", // Antonio Cabrera (Referrer)
    "42fa3813-8b50-42bb-96c5-751642dae55f" // Mariano Cabrera (Referrer)
  ];

  const existingUsers = await prisma.user.findMany({
    where: {
      id: {
        in: requiredUserIds
      }
    },
    select: { id: true }
  });

  const existingUserIds = new Set(existingUsers.map((u) => u.id));
  const userValidationMap = new Map<string, boolean>();

  for (const userId of requiredUserIds) {
    userValidationMap.set(userId, existingUserIds.has(userId));
  }

  return userValidationMap;
}

/**
 * Create required users if they don't exist
 */
async function createRequiredUsers(userValidationMap: Map<string, boolean>): Promise<void> {
  const usersToCreate = [
    {
      id: "7a8bbcaa-063d-4fce-ae02-da9356dac213",
      name: "Pedro Sanders",
      phone: "+18091234567",
      roles: [{ role: "ADMIN" }, { role: "COLLECTOR" }]
    },
    {
      id: "6ce9e266-b2fb-4dce-b21b-d0842fd78b36",
      name: "Isaic Santos",
      phone: "+18092345678",
      roles: [{ role: "REFERRER" }]
    },
    {
      id: "3757f991-57b3-4163-a8b5-387b97fa7dfe",
      name: "Antonio Cabrera",
      phone: "+18093456789",
      roles: [{ role: "REFERRER" }]
    },
    {
      id: "42fa3813-8b50-42bb-96c5-751642dae55f",
      name: "Mariano Cabrera",
      phone: "+18094567890",
      roles: [{ role: "REFERRER" }]
    }
  ];

  for (const userData of usersToCreate) {
    if (!userValidationMap.get(userData.id)) {
      console.log(`Creating user: ${userData.name} (${userData.id})`);

      await prisma.user.upsert({
        where: { id: userData.id },
        update: {},
        create: {
          id: userData.id,
          name: userData.name,
          phone: userData.phone,
          roles: {
            create: userData.roles
          }
        }
      });
    }
  }
}

/**
 * Normalize phone number using the same validation as the API
 */
function normalizePhone(phone: string): string {
  if (!phone || phone.trim() === "") {
    return "";
  }
  try {
    // Use the same validation function as the API
    return validateDominicanPhone(phone);
  } catch {
    console.warn(`Invalid phone number: ${phone}, using as-is`);
    return phone.trim();
  }
}

/**
 * Process a single member and their loan/payments
 */
async function processMember(
  memberData: MemberData,
  rowIndex: number,
  stats: MigrationStats
): Promise<void> {
  try {
    console.log(`Processing member ${rowIndex + 1}: ${memberData.name} (${memberData.phone})`);

    // Normalize phone number
    const normalizedPhone = normalizePhone(memberData.phone);

    // Check if member already exists by phone or ID number
    const existingMember = await prisma.member.findFirst({
      where: {
        OR: [{ phone: normalizedPhone }, { idNumber: memberData.idNumber }]
      },
      include: {
        loans: {
          include: { payments: true }
        }
      }
    });

    if (existingMember) {
      console.log(`Member already exists: ${memberData.name}`);

      // Check if loan needs to be processed for existing member
      if (memberData.loan) {
        await processLoanForExistingMember(
          memberData.loan,
          existingMember,
          memberData.assignedCollectorId,
          rowIndex,
          stats
        );
      }

      stats.membersSkipped++;
      return;
    }

    // Create member
    const createdMember = await prisma.member.create({
      data: {
        name: memberData.name,
        phone: normalizedPhone,
        idNumber: memberData.idNumber,
        collectionPoint: memberData.collectionPoint,
        homeAddress: memberData.homeAddress,
        jobPosition: memberData.jobPosition,
        income: memberData.income,
        isBusinessOwner: memberData.isBusinessOwner,
        idCardOnRecord: memberData.idCardOnRecord,
        isActive: memberData.isActive,
        referredById: memberData.referredById,
        assignedCollectorId: memberData.assignedCollectorId,
        createdAt: new Date(memberData.createdAt)
      }
    });

    stats.membersCreated++;
    console.log(`Created member: ${createdMember.name} (${createdMember.id})`);

    // Process loan if it exists
    if (memberData.loan) {
      await processLoan(
        memberData.loan,
        createdMember.id,
        memberData.assignedCollectorId,
        rowIndex,
        stats
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    stats.errors.push({
      row: rowIndex + 1,
      error: errorMessage
    });
    stats.membersSkipped++;
    console.error(`Error processing member ${rowIndex + 1}:`, error);
  }
}

/**
 * Process a loan for an existing member
 */
async function processLoanForExistingMember(
  loanData: LoanData,
  existingMember: {
    id: string;
    name: string;
    loans: Array<{ loanId: number; payments?: unknown[] }>;
  },
  assignedCollectorId: string,
  rowIndex: number,
  stats: MigrationStats
): Promise<void> {
  // Find the loan for this member
  const existingLoan = existingMember.loans.find((loan) => loan.loanId === loanData.loanId);

  if (!existingLoan) {
    console.log(
      `Loan ${loanData.loanId} not found for existing member ${existingMember.name}, skipping`
    );
    return;
  }

  // Check if payments need to be created
  if (existingLoan.payments.length === 0 && loanData.payments.length > 0) {
    console.log(
      `Creating ${loanData.payments.length} payments for existing loan: ${loanData.loanId}`
    );
    // Create payments for existing loan
    for (const paymentData of loanData.payments) {
      try {
        await prisma.payment.create({
          data: {
            amount: paymentData.amount,
            paidAt: new Date(paymentData.createdAt),
            method: paymentData.method,
            status: "COMPLETED",
            loanId: existingLoan.id,
            collectedById: assignedCollectorId
          }
        });
        stats.paymentsCreated++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        stats.errors.push({
          row: rowIndex + 1,
          error: `Payment creation failed for existing loan: ${errorMessage}`
        });
        stats.paymentsSkipped++;
      }
    }
  } else {
    console.log(`Loan ${loanData.loanId} already has ${existingLoan.payments.length} payments`);
  }
}

/**
 * Process a loan and its payments
 */
async function processLoan(
  loanData: LoanData,
  memberId: string,
  assignedCollectorId: string,
  rowIndex: number,
  stats: MigrationStats
): Promise<void> {
  try {
    // Check if loan ID already exists
    const existingLoan = await prisma.loan.findUnique({
      where: { loanId: loanData.loanId },
      include: { payments: true }
    });

    if (existingLoan) {
      // Loan exists, check if payments need to be created
      if (existingLoan.payments.length === 0 && loanData.payments.length > 0) {
        console.log(`Creating payments for existing loan: ${loanData.loanId}`);
        // Create payments for existing loan
        for (const paymentData of loanData.payments) {
          try {
            await prisma.payment.create({
              data: {
                amount: paymentData.amount,
                paidAt: new Date(paymentData.createdAt),
                method: paymentData.method,
                status: "COMPLETED",
                loanId: existingLoan.id,
                collectedById: assignedCollectorId
              }
            });
            stats.paymentsCreated++;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            stats.errors.push({
              row: rowIndex + 1,
              error: `Payment creation failed for existing loan: ${errorMessage}`
            });
            stats.paymentsSkipped++;
          }
        }
      }
      stats.loansSkipped++;
      return;
    }

    // Create loan
    const createdLoan = await prisma.loan.create({
      data: {
        loanId: loanData.loanId,
        type: loanData.type,
        status: loanData.status,
        principal: loanData.principal,
        termLength: loanData.termLength,
        paymentAmount: loanData.paymentAmount,
        paymentFrequency: loanData.paymentFrequency,
        memberId: memberId
      }
    });

    stats.loansCreated++;
    console.log(`Created loan: ${createdLoan.loanId} for member ${memberId}`);

    // Process payments
    for (const paymentData of loanData.payments) {
      try {
        await prisma.payment.create({
          data: {
            amount: paymentData.amount,
            paidAt: new Date(paymentData.createdAt),
            method: paymentData.method,
            status: "COMPLETED",
            loanId: createdLoan.id,
            collectedById: assignedCollectorId // Use the member's assigned collector
          }
        });
        stats.paymentsCreated++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        stats.errors.push({
          row: rowIndex + 1,
          error: `Payment creation failed: ${errorMessage}`
        });
        stats.paymentsSkipped++;
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    stats.errors.push({
      row: rowIndex + 1,
      error: errorMessage
    });
    stats.loansSkipped++;
    console.error(`Error processing loan for member ${memberId}:`, error);
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log("Mikro JSON Migration");
  console.log("===================\n");

  const migrationDataPath = join(ROOT_DIR, "migration-data.json");
  console.log(`Reading migration data from: ${migrationDataPath}\n`);

  // Read and parse migration data
  let migrationData: MemberData[];
  try {
    const data = readFileSync(migrationDataPath, "utf-8");
    migrationData = JSON.parse(data) as MemberData[];
  } catch (error) {
    console.error("Failed to read or parse migration-data.json:", error);
    process.exit(1);
  }

  console.log(`Found ${migrationData.length} members to process\n`);

  // Validate and create required users
  console.log("Validating required users...");
  const userValidationMap = await validateRequiredUsers();

  const missingUsers = Array.from(userValidationMap.entries())
    .filter(([, exists]) => !exists)
    .map(([id]) => id);

  if (missingUsers.length > 0) {
    console.log(`Creating ${missingUsers.length} missing users...`);
    await createRequiredUsers(userValidationMap);
  } else {
    console.log("All required users exist.");
  }

  // Initialize statistics
  const stats: MigrationStats = {
    total: migrationData.length,
    membersCreated: 0,
    membersSkipped: 0,
    loansCreated: 0,
    loansSkipped: 0,
    paymentsCreated: 0,
    paymentsSkipped: 0,
    errors: []
  };

  // Process each member
  console.log("\nProcessing members...");
  for (let i = 0; i < migrationData.length; i++) {
    await processMember(migrationData[i], i, stats);
  }

  // Print summary
  console.log("\n" + "=".repeat(50));
  console.log("Migration Summary");
  console.log("=".repeat(50));
  console.log(`Total members processed: ${stats.total}`);
  console.log(`Members created: ${stats.membersCreated}`);
  console.log(`Members skipped: ${stats.membersSkipped}`);
  console.log(`Loans created: ${stats.loansCreated}`);
  console.log(`Loans skipped: ${stats.loansSkipped}`);
  console.log(`Payments created: ${stats.paymentsCreated}`);
  console.log(`Payments skipped: ${stats.paymentsSkipped}`);

  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`);
    stats.errors.forEach((err) => {
      console.log(`  Row ${err.row}: ${err.error}`);
    });
  }

  console.log("\nMigration completed!");
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
