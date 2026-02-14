/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";

const adapter = new PrismaBetterSqlite3({
  url: process.env.MIKRO_DATABASE_URL || "file:./data/mikro.db"
});

const prisma = new PrismaClient({ adapter });

// Helper to generate loan IDs starting at 10000
async function getNextLoanId(): Promise<number> {
  const lastLoan = await prisma.loan.findFirst({
    orderBy: { loanId: "desc" }
  });
  return lastLoan ? lastLoan.loanId + 1 : 10000;
}

async function main() {
  console.log("Seeding database...");

  // Create sample users
  const admin = await prisma.user.upsert({
    where: { id: "user-admin-001" },
    update: {},
    create: {
      id: "user-admin-001",
      name: "Admin User",
      phone: "+1000000001",
      roles: {
        create: [{ role: "ADMIN" }]
      }
    }
  });

  const collector = await prisma.user.upsert({
    where: { id: "user-collector-001" },
    update: {},
    create: {
      id: "user-collector-001",
      name: "Juan Collector",
      phone: "+1000000002",
      roles: {
        create: [{ role: "COLLECTOR" }]
      }
    }
  });

  const referrer = await prisma.user.upsert({
    where: { id: "user-referrer-001" },
    update: {},
    create: {
      id: "user-referrer-001",
      name: "Maria Referrer",
      phone: "+1000000003",
      roles: {
        create: [{ role: "REFERRER" }]
      }
    }
  });

  console.log("Created users:", { admin, collector, referrer });

  // Create sample members
  const member1 = await prisma.member.upsert({
    where: { id: "member-001" },
    update: {},
    create: {
      id: "member-001",
      name: "Alice Smith",
      phone: "+1234567890",
      idNumber: "ID-12345",
      collectionPoint: "Market Square",
      homeAddress: "123 Main St, City",
      jobPosition: "Shop Owner",
      income: 5000,
      isBusinessOwner: true,
      idCardOnRecord: true,
      createdById: admin.id,
      referredById: referrer.id,
      assignedCollectorId: collector.id
    }
  });

  const member2 = await prisma.member.upsert({
    where: { id: "member-002" },
    update: {},
    create: {
      id: "member-002",
      name: "Bob Johnson",
      phone: "+0987654321",
      idNumber: "ID-67890",
      collectionPoint: "Downtown Plaza",
      homeAddress: "456 Oak Ave, Town",
      createdById: admin.id,
      referredById: referrer.id
    }
  });

  console.log("Created members:", { member1, member2 });

  // Create a sample loan for member1
  const loanId = await getNextLoanId();
  const loan = await prisma.loan.upsert({
    where: { id: "loan-001" },
    update: {},
    create: {
      id: "loan-001",
      loanId: loanId,
      type: "FIVE_K_AT_10_WEEKS",
      status: "ACTIVE",
      principal: 5000,
      termLength: 10,
      memberId: member1.id
    }
  });

  console.log("Created loan:", loan);

  // Create sample chat messages for member1
  const message1 = await prisma.message.upsert({
    where: { id: "msg-001" },
    update: {},
    create: {
      id: "msg-001",
      role: "HUMAN",
      content: "Hello, I would like to apply for a loan.",
      memberId: member1.id
    }
  });

  const message2 = await prisma.message.upsert({
    where: { id: "msg-002" },
    update: {},
    create: {
      id: "msg-002",
      role: "AI",
      content:
        "Hello Alice! I can help you with that. I see you already have an active loan. Would you like to check its status?",
      tools: JSON.stringify(["check_loan_status", "get_member_info"]),
      memberId: member1.id
    }
  });

  console.log("Created messages:", { message1, message2 });

  console.log("Database seeding completed!");
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
