/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Loads repo-root .env so MIKRO_CONFIG_FILE is set, then reads databaseUrl via getDatabaseUrlFromFile (same as rest of app).
 */
import { config as loadDotenv } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { getDatabaseUrlFromFile } from "@mikro/common";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

loadDotenv({ path: resolve(repoRoot, ".env") });

const adapter = new PrismaBetterSqlite3({
  url: getDatabaseUrlFromFile(undefined, repoRoot)
});

const prisma = new PrismaClient({ adapter });

// -----------------------------------------------------------------------------
// Hardcoded UUIDs for deterministic, idempotent seeding
// -----------------------------------------------------------------------------
const ID = {
  users: {
    admin: "11111111-1111-4111-a111-111111111111",
    collector1: "22222222-2222-4222-a222-222222222221",
    collector2: "22222222-2222-4222-a222-222222222222",
    referrer1: "33333333-3333-4333-a333-333333333331",
    referrer2: "33333333-3333-4333-a333-333333333332"
  },
  customers: [
    "44444444-4444-4444-a444-444444444401",
    "44444444-4444-4444-a444-444444444402",
    "44444444-4444-4444-a444-444444444403",
    "44444444-4444-4444-a444-444444444404",
    "44444444-4444-4444-a444-444444444405",
    "44444444-4444-4444-a444-444444444406",
    "44444444-4444-4444-a444-444444444407",
    "44444444-4444-4444-a444-444444444408",
    "44444444-4444-4444-a444-444444444409",
    "44444444-4444-4444-a444-444444444410"
  ],
  loans: [
    "55555555-5555-4555-a555-555555555501",
    "55555555-5555-4555-a555-555555555502",
    "55555555-5555-4555-a555-555555555503",
    "55555555-5555-4555-a555-555555555504",
    "55555555-5555-4555-a555-555555555505",
    "55555555-5555-4555-a555-555555555506",
    "55555555-5555-4555-a555-555555555507",
    "55555555-5555-4555-a555-555555555508",
    "55555555-5555-4555-a555-555555555509",
    "55555555-5555-4555-a555-555555555510",
    "55555555-5555-4555-a555-555555555511",
    "55555555-5555-4555-a555-555555555512",
    "55555555-5555-4555-a555-555555555513",
    "55555555-5555-4555-a555-555555555514",
    "55555555-5555-4555-a555-555555555515",
    "55555555-5555-4555-a555-555555555516",
    "55555555-5555-4555-a555-555555555517"
  ],
  payments: [] as string[],
  loanNotes: [
    "66666666-6666-4666-a666-666666666601",
    "66666666-6666-4666-a666-666666666602",
    "66666666-6666-4666-a666-666666666603",
    "66666666-6666-4666-a666-666666666604",
    "66666666-6666-4666-a666-666666666605"
  ],
  messages: [
    "77777777-7777-4777-a777-777777777701",
    "77777777-7777-4777-a777-777777777702",
    "77777777-7777-4777-a777-777777777703",
    "77777777-7777-4777-a777-777777777704",
    "77777777-7777-4777-a777-777777777705",
    "77777777-7777-4777-a777-777777777706",
    "77777777-7777-4777-a777-777777777707",
    "77777777-7777-4777-a777-777777777708"
  ],
  attachments: [
    "88888888-8888-4888-a888-888888888801",
    "88888888-8888-4888-a888-888888888802",
    "88888888-8888-4888-a888-888888888803"
  ],
  collectionAttempts: [
    "99999999-9999-4999-a999-999999999901",
    "99999999-9999-4999-a999-999999999902",
    "99999999-9999-4999-a999-999999999903",
    "99999999-9999-4999-a999-999999999904",
    "99999999-9999-4999-a999-999999999905",
    "99999999-9999-4999-a999-999999999906",
    "99999999-9999-4999-a999-999999999907",
    "99999999-9999-4999-a999-999999999908"
  ]
};

// Generate payment UUIDs (we'll create many)
for (let i = 1; i <= 100; i++) {
  const hex = i.toString(16).padStart(2, "0");
  ID.payments.push(`aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaa${hex}`);
}

// Helper to generate loan IDs starting at 10000
async function getNextLoanId(): Promise<number> {
  const lastLoan = await prisma.loan.findFirst({
    orderBy: { loanId: "desc" }
  });
  return lastLoan ? lastLoan.loanId + 1 : 10000;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

async function main() {
  console.log("Seeding database...");

  const devPasswordHash = await bcrypt.hash("password123", 10);

  // ---------------------------------------------------------------------------
  // Users (5): 1 admin, 2 collectors, 2 referrers (dev password: password123)
  // ---------------------------------------------------------------------------
  const admin = await prisma.user.upsert({
    where: { id: ID.users.admin },
    update: { password: devPasswordHash },
    create: {
      id: ID.users.admin,
      name: "Admin User",
      phone: "+1000000001",
      password: devPasswordHash,
      roles: { create: [{ role: "ADMIN" }] }
    }
  });

  const collector1 = await prisma.user.upsert({
    where: { id: ID.users.collector1 },
    update: { password: devPasswordHash },
    create: {
      id: ID.users.collector1,
      name: "Juan Collector",
      phone: "+1000000002",
      password: devPasswordHash,
      roles: { create: [{ role: "COLLECTOR" }] }
    }
  });

  const collector2 = await prisma.user.upsert({
    where: { id: ID.users.collector2 },
    update: { password: devPasswordHash },
    create: {
      id: ID.users.collector2,
      name: "Ana Collector",
      phone: "+1000000003",
      password: devPasswordHash,
      roles: { create: [{ role: "COLLECTOR" }] }
    }
  });

  const referrer1 = await prisma.user.upsert({
    where: { id: ID.users.referrer1 },
    update: { password: devPasswordHash },
    create: {
      id: ID.users.referrer1,
      name: "Maria Referrer",
      phone: "+1000000004",
      password: devPasswordHash,
      roles: { create: [{ role: "REFERRER" }] }
    }
  });

  const referrer2 = await prisma.user.upsert({
    where: { id: ID.users.referrer2 },
    update: { password: devPasswordHash },
    create: {
      id: ID.users.referrer2,
      name: "Pedro Referrer",
      phone: "+1000000005",
      password: devPasswordHash,
      roles: { create: [{ role: "REFERRER" }] }
    }
  });

  const collectors = [collector1, collector2];
  const referrers = [referrer1, referrer2];
  console.log("Created 5 users");

  // ---------------------------------------------------------------------------
  // Customers (10)
  // ---------------------------------------------------------------------------
  const customerNames = [
    "Alice Smith",
    "Bob Johnson",
    "Carol Williams",
    "David Brown",
    "Eve Davis",
    "Frank Miller",
    "Grace Wilson",
    "Henry Moore",
    "Ivy Taylor",
    "Jack Anderson"
  ];
  const customers: Awaited<ReturnType<typeof prisma.customer.upsert>>[] = [];
  for (let i = 0; i < 10; i++) {
    const referredBy = referrers[i % 2];
    const assignedCollector = i < 6 ? collectors[i % 2] : null;
    const c = await prisma.customer.upsert({
      where: { id: ID.customers[i] },
      update: {},
      create: {
        id: ID.customers[i],
        name: customerNames[i],
        nickname: i === 0 ? "Ali" : null,
        phone: `+12345678${String(i).padStart(2, "0")}`,
        idNumber: `ID-${10000 + i}`,
        collectionPoint: i % 2 === 0 ? `Point ${i + 1}` : null,
        homeAddress: `${100 + i} Main St`,
        jobPosition: i % 3 === 0 ? "Shop Owner" : i % 3 === 1 ? "Driver" : null,
        income: i % 2 === 0 ? 3000 + i * 200 : null,
        isBusinessOwner: i % 4 === 0,
        isActive: i < 7,
        idCardOnRecord: i % 2 === 1,
        notes: i === 2 || i === 5 ? "Follow up on payment" : null,
        preferredPaymentDay: i % 2 === 0 ? "FRIDAY" : i % 2 === 1 ? "MONDAY" : null,
        createdById: admin.id,
        referredById: referredBy.id,
        assignedCollectorId: assignedCollector?.id ?? null
      }
    });
    customers.push(c);
  }
  console.log("Created 10 customers");

  // ---------------------------------------------------------------------------
  // Loans (17): at least 1 per customer, some with 2; mix statuses & frequencies
  // ---------------------------------------------------------------------------
  const startLoanId = await getNextLoanId();
  const loanSpecs: Array<{
    id: string;
    customerIndex: number;
    status: "ACTIVE" | "COMPLETED" | "DEFAULTED" | "CANCELLED";
    frequency: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
    principal: number;
    termLength: number;
    paymentAmount: number;
    startingDate?: Date;
    nickname?: string;
  }> = [
    {
      id: ID.loans[0],
      customerIndex: 0,
      status: "ACTIVE",
      frequency: "WEEKLY",
      principal: 5000,
      termLength: 10,
      paymentAmount: 550,
      nickname: "First loan"
    },
    {
      id: ID.loans[1],
      customerIndex: 0,
      status: "COMPLETED",
      frequency: "BIWEEKLY",
      principal: 3000,
      termLength: 6,
      paymentAmount: 550
    },
    {
      id: ID.loans[2],
      customerIndex: 1,
      status: "ACTIVE",
      frequency: "MONTHLY",
      principal: 10000,
      termLength: 12,
      paymentAmount: 950,
      startingDate: new Date("2025-01-15")
    },
    {
      id: ID.loans[3],
      customerIndex: 1,
      status: "DEFAULTED",
      frequency: "WEEKLY",
      principal: 2000,
      termLength: 4,
      paymentAmount: 550
    },
    {
      id: ID.loans[4],
      customerIndex: 2,
      status: "COMPLETED",
      frequency: "DAILY",
      principal: 1000,
      termLength: 14,
      paymentAmount: 80
    },
    {
      id: ID.loans[5],
      customerIndex: 2,
      status: "ACTIVE",
      frequency: "WEEKLY",
      principal: 4000,
      termLength: 8,
      paymentAmount: 520
    },
    {
      id: ID.loans[6],
      customerIndex: 3,
      status: "CANCELLED",
      frequency: "BIWEEKLY",
      principal: 5000,
      termLength: 10,
      paymentAmount: 550
    },
    {
      id: ID.loans[7],
      customerIndex: 3,
      status: "ACTIVE",
      frequency: "MONTHLY",
      principal: 7000,
      termLength: 10,
      paymentAmount: 750
    },
    {
      id: ID.loans[8],
      customerIndex: 4,
      status: "COMPLETED",
      frequency: "WEEKLY",
      principal: 6000,
      termLength: 12,
      paymentAmount: 550
    },
    {
      id: ID.loans[9],
      customerIndex: 5,
      status: "ACTIVE",
      frequency: "BIWEEKLY",
      principal: 8000,
      termLength: 8,
      paymentAmount: 1050
    },
    {
      id: ID.loans[10],
      customerIndex: 6,
      status: "COMPLETED",
      frequency: "MONTHLY",
      principal: 5000,
      termLength: 6,
      paymentAmount: 900
    },
    {
      id: ID.loans[11],
      customerIndex: 7,
      status: "ACTIVE",
      frequency: "WEEKLY",
      principal: 3000,
      termLength: 6,
      paymentAmount: 550
    },
    {
      id: ID.loans[12],
      customerIndex: 8,
      status: "DEFAULTED",
      frequency: "DAILY",
      principal: 1500,
      termLength: 10,
      paymentAmount: 165
    },
    {
      id: ID.loans[13],
      customerIndex: 8,
      status: "ACTIVE",
      frequency: "MONTHLY",
      principal: 4000,
      termLength: 5,
      paymentAmount: 850
    },
    {
      id: ID.loans[14],
      customerIndex: 9,
      status: "COMPLETED",
      frequency: "WEEKLY",
      principal: 2500,
      termLength: 5,
      paymentAmount: 530
    },
    {
      id: ID.loans[15],
      customerIndex: 9,
      status: "ACTIVE",
      frequency: "BIWEEKLY",
      principal: 4500,
      termLength: 6,
      paymentAmount: 800
    },
    {
      id: ID.loans[16],
      customerIndex: 4,
      status: "ACTIVE",
      frequency: "WEEKLY",
      principal: 3500,
      termLength: 7,
      paymentAmount: 520,
      nickname: "Second loan"
    }
  ];

  const loans: Array<{
    id: string;
    status: string;
    customerId: string;
    paymentAmount: number;
    termLength: number;
    frequency: string;
    startingDate: Date | null;
  }> = [];
  for (let i = 0; i < loanSpecs.length; i++) {
    const spec = loanSpecs[i];
    const startDate = spec.startingDate ?? new Date();
    const loan = await prisma.loan.upsert({
      where: { id: spec.id },
      update: {},
      create: {
        id: spec.id,
        loanId: startLoanId + i,
        type: "SAN",
        status: spec.status,
        principal: spec.principal,
        termLength: spec.termLength,
        paymentAmount: spec.paymentAmount,
        paymentFrequency: spec.frequency,
        startingDate: startDate,
        nickname: spec.nickname ?? null,
        customerId: customers[spec.customerIndex].id
      }
    });
    loans.push({
      id: loan.id,
      status: loan.status,
      customerId: loan.customerId,
      paymentAmount: Number(loan.paymentAmount),
      termLength: loan.termLength,
      frequency: loan.paymentFrequency,
      startingDate: loan.startingDate
    });
  }
  console.log("Created 17 loans");

  // ---------------------------------------------------------------------------
  // Payments over time (for ACTIVE and COMPLETED loans)
  // ---------------------------------------------------------------------------
  let paymentIdx = 0;
  const getPaymentId = () => ID.payments[paymentIdx++] ?? crypto.randomUUID();

  for (const loan of loans) {
    if (loan.status !== "ACTIVE" && loan.status !== "COMPLETED") continue;
    const numPayments =
      loan.status === "COMPLETED"
        ? loan.termLength
        : Math.max(1, Math.floor(loan.termLength * 0.5));
    const start = loan.startingDate
      ? new Date(loan.startingDate)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const collector = collectors[paymentIdx % 2];

    for (let p = 0; p < numPayments; p++) {
      let paidAt: Date;
      if (loan.frequency === "DAILY") paidAt = addDays(start, p);
      else if (loan.frequency === "WEEKLY") paidAt = addDays(start, p * 7);
      else if (loan.frequency === "BIWEEKLY") paidAt = addDays(start, p * 14);
      else paidAt = addDays(start, p * 30);

      const method = p % 3 === 0 ? "TRANSFER" : "CASH";
      let status: "COMPLETED" | "PARTIAL" | "REVERSED" | "PENDING" = "COMPLETED";
      if (loan.status === "ACTIVE" && p === numPayments - 1 && paymentIdx % 7 === 3)
        status = "PENDING";
      else if (paymentIdx % 11 === 5) status = "REVERSED";

      const paymentId = getPaymentId();
      await prisma.payment.upsert({
        where: { id: paymentId },
        update: {},
        create: {
          id: paymentId,
          amount: loan.paymentAmount,
          paidAt,
          method,
          status,
          notes: p === 0 ? "First payment" : null,
          loanId: loan.id,
          collectedById: collector.id
        }
      });
    }
  }
  console.log("Created payments over time for ACTIVE/COMPLETED loans");

  // ---------------------------------------------------------------------------
  // LoanNotes (5)
  // ---------------------------------------------------------------------------
  const loanNoteSpecs = [
    { loanIndex: 0, author: admin, content: "Customer requested extension; approved one week." },
    { loanIndex: 2, author: collector1, content: "Payment reminder sent via WhatsApp." },
    { loanIndex: 5, author: collector2, content: "Visit scheduled for Friday." },
    { loanIndex: 7, author: admin, content: "ID verified on file." },
    { loanIndex: 11, author: collector1, content: "Customer confirmed next payment date." }
  ];
  for (let i = 0; i < loanNoteSpecs.length; i++) {
    const { loanIndex, author, content } = loanNoteSpecs[i];
    await prisma.loanNote.upsert({
      where: { id: ID.loanNotes[i] },
      update: {},
      create: {
        id: ID.loanNotes[i],
        content,
        loanId: loans[loanIndex].id,
        createdById: author.id
      }
    });
  }
  console.log("Created 5 loan notes");

  // ---------------------------------------------------------------------------
  // Messages (2–3 conversations, 8 messages total)
  // ---------------------------------------------------------------------------
  const messageSpecs: Array<{
    id: string;
    role: "AI" | "HUMAN";
    content: string;
    customerIndex: number;
    tools?: string;
  }> = [
    {
      id: ID.messages[0],
      role: "HUMAN",
      content: "Hello, I would like to apply for a loan.",
      customerIndex: 0
    },
    {
      id: ID.messages[1],
      role: "AI",
      content: "Hello! I can help you with that. Would you like to check your current loan status?",
      customerIndex: 0,
      tools: JSON.stringify(["check_loan_status", "get_customer_info"])
    },
    { id: ID.messages[2], role: "HUMAN", content: "Yes, please.", customerIndex: 0 },
    {
      id: ID.messages[3],
      role: "AI",
      content: "You have one active loan and one completed. Your next payment is due Friday.",
      customerIndex: 0,
      tools: JSON.stringify(["check_loan_status"])
    },
    { id: ID.messages[4], role: "HUMAN", content: "When is my payment due?", customerIndex: 2 },
    {
      id: ID.messages[5],
      role: "AI",
      content: "Your next payment is due next Monday. Amount: 520.",
      customerIndex: 2,
      tools: JSON.stringify(["check_loan_status"])
    },
    { id: ID.messages[6], role: "HUMAN", content: "I need to reschedule.", customerIndex: 5 },
    {
      id: ID.messages[7],
      role: "AI",
      content: "I can help with that. A collector will contact you shortly.",
      customerIndex: 5,
      tools: JSON.stringify(["get_customer_info"])
    }
  ];
  for (const m of messageSpecs) {
    await prisma.message.upsert({
      where: { id: m.id },
      update: {},
      create: {
        id: m.id,
        role: m.role,
        content: m.content,
        tools: m.tools ?? null,
        customerId: customers[m.customerIndex].id
      }
    });
  }
  console.log("Created 8 messages");

  // ---------------------------------------------------------------------------
  // Attachments (3, on messages)
  // ---------------------------------------------------------------------------
  await prisma.attachment.upsert({
    where: { id: ID.attachments[0] },
    update: {},
    create: {
      id: ID.attachments[0],
      type: "IMAGE",
      url: "https://example.com/photo1.jpg",
      name: "id_photo.jpg",
      mimeType: "image/jpeg",
      size: 102400,
      messageId: ID.messages[0]
    }
  });
  await prisma.attachment.upsert({
    where: { id: ID.attachments[1] },
    update: {},
    create: {
      id: ID.attachments[1],
      type: "DOCUMENT",
      url: "https://example.com/doc.pdf",
      name: "contract.pdf",
      mimeType: "application/pdf",
      size: 50000,
      messageId: ID.messages[1]
    }
  });
  await prisma.attachment.upsert({
    where: { id: ID.attachments[2] },
    update: {},
    create: {
      id: ID.attachments[2],
      type: "IMAGE",
      url: "https://example.com/receipt.png",
      messageId: ID.messages[4]
    }
  });
  console.log("Created 3 attachments");

  // ---------------------------------------------------------------------------
  // CollectionAttempts (8): mix channel, type, status
  // ---------------------------------------------------------------------------
  const attemptSpecs: Array<{
    customerId: string;
    loanId: string;
    channel: "WHATSAPP" | "PHONE_CALL";
    type: "PAYMENT_CONFIRMATION" | "PAYMENT_REMINDER" | "OVERDUE_NOTICE" | "COLLECTION_CALL";
    status: "SENT" | "FAILED";
  }> = [
    {
      customerId: customers[0].id,
      loanId: loans[0].id,
      channel: "WHATSAPP",
      type: "PAYMENT_REMINDER",
      status: "SENT"
    },
    {
      customerId: customers[1].id,
      loanId: loans[2].id,
      channel: "PHONE_CALL",
      type: "PAYMENT_CONFIRMATION",
      status: "SENT"
    },
    {
      customerId: customers[2].id,
      loanId: loans[5].id,
      channel: "WHATSAPP",
      type: "OVERDUE_NOTICE",
      status: "SENT"
    },
    {
      customerId: customers[3].id,
      loanId: loans[3].id,
      channel: "PHONE_CALL",
      type: "COLLECTION_CALL",
      status: "FAILED"
    },
    {
      customerId: customers[4].id,
      loanId: loans[8].id,
      channel: "WHATSAPP",
      type: "PAYMENT_CONFIRMATION",
      status: "SENT"
    },
    {
      customerId: customers[5].id,
      loanId: loans[9].id,
      channel: "WHATSAPP",
      type: "PAYMENT_REMINDER",
      status: "SENT"
    },
    {
      customerId: customers[7].id,
      loanId: loans[11].id,
      channel: "PHONE_CALL",
      type: "OVERDUE_NOTICE",
      status: "FAILED"
    },
    {
      customerId: customers[9].id,
      loanId: loans[15].id,
      channel: "WHATSAPP",
      type: "PAYMENT_REMINDER",
      status: "SENT"
    }
  ];
  for (let i = 0; i < attemptSpecs.length; i++) {
    const a = attemptSpecs[i];
    await prisma.collectionAttempt.upsert({
      where: { id: ID.collectionAttempts[i] },
      update: {},
      create: {
        id: ID.collectionAttempts[i],
        channel: a.channel,
        type: a.type,
        status: a.status,
        templateName: a.channel === "WHATSAPP" ? "payment_reminder_v1" : null,
        notes: a.status === "FAILED" ? "No answer" : null,
        customerId: a.customerId,
        loanId: a.loanId
      }
    });
  }
  console.log("Created 8 collection attempts");

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
