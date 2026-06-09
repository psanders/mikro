/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Loads repo-root .env so MIKRO_CONFIG_FILE is set, then resolves databaseUrl
 * from the config file. The resolution is inlined (mirrors `getDatabaseUrlFromFile`
 * in @mikro/common) so the seed doesn't import the @mikro/common barrel, which
 * pulls in the receipt stack and its native @resvg/resvg-js binding — needless
 * here and a break point in CI when the platform binary isn't installed.
 */
import { existsSync, readFileSync } from "fs";
import { config as loadDotenv } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

loadDotenv({ path: resolve(repoRoot, ".env") });

/** Runtime/Docker default; mirrors @mikro/common's DEFAULT_DATABASE_URL. */
const DEFAULT_DATABASE_URL = "file:/app/data/mikro.db";

function databaseUrl(): string {
  const filePath = resolve(repoRoot, process.env.MIKRO_CONFIG_FILE ?? "mikro.json");
  if (!existsSync(filePath)) return DEFAULT_DATABASE_URL;
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf-8")) as { databaseUrl?: unknown };
    if (typeof raw.databaseUrl === "string" && raw.databaseUrl.trim()) return raw.databaseUrl;
  } catch {
    // fall through to default
  }
  return DEFAULT_DATABASE_URL;
}

const adapter = new PrismaBetterSqlite3({
  url: databaseUrl()
});

const prisma = new PrismaClient({ adapter });

// -----------------------------------------------------------------------------
// Hardcoded UUIDs for deterministic, idempotent seeding
// -----------------------------------------------------------------------------
const ID = {
  users: {
    admin: "11111111-1111-4111-a111-111111111111",
    collector1: "22222222-2222-4222-a222-222222222221",
    collector2: "22222222-2222-4222-a222-222222222222"
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
  accountingAccounts: [
    "cccccccc-cccc-4ccc-accc-cccccccccc01",
    "cccccccc-cccc-4ccc-accc-cccccccccc02",
    "cccccccc-cccc-4ccc-accc-cccccccccc03",
    "cccccccc-cccc-4ccc-accc-cccccccccc04"
  ],
  accountingCategories: [
    "dddddddd-dddd-4ddd-addd-000000000001",
    "dddddddd-dddd-4ddd-addd-000000000002",
    "dddddddd-dddd-4ddd-addd-000000000003",
    "dddddddd-dddd-4ddd-addd-000000000004",
    "dddddddd-dddd-4ddd-addd-000000000005",
    "dddddddd-dddd-4ddd-addd-000000000006",
    "dddddddd-dddd-4ddd-addd-000000000007",
    "dddddddd-dddd-4ddd-addd-000000000008",
    "dddddddd-dddd-4ddd-addd-000000000009",
    "dddddddd-dddd-4ddd-addd-00000000000a",
    "dddddddd-dddd-4ddd-addd-00000000000b"
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
  // Users (3): 1 admin, 2 collectors (dev password: password123)
  // ---------------------------------------------------------------------------
  const admin = await prisma.user.upsert({
    where: { id: ID.users.admin },
    update: { password: devPasswordHash, phone: "+18095551234" },
    create: {
      id: ID.users.admin,
      name: "Admin User",
      // Valid E.164 (DR) — login validates via the `phone` library, which
      // rejects placeholder numbers like +1000000001.
      phone: "+18095551234",
      password: devPasswordHash,
      roles: { create: [{ role: "ADMIN" }] }
    }
  });

  const collector1 = await prisma.user.upsert({
    where: { id: ID.users.collector1 },
    update: { password: devPasswordHash, phone: "+18091112233" },
    create: {
      id: ID.users.collector1,
      name: "Juan Collector",
      phone: "+18091112233",
      password: devPasswordHash,
      roles: { create: [{ role: "COLLECTOR" }] }
    }
  });

  const collector2 = await prisma.user.upsert({
    where: { id: ID.users.collector2 },
    update: { password: devPasswordHash, phone: "+18092223344" },
    create: {
      id: ID.users.collector2,
      name: "Ana Collector",
      phone: "+18092223344",
      password: devPasswordHash,
      roles: { create: [{ role: "COLLECTOR" }] }
    }
  });

  const collectors = [collector1, collector2];
  console.log("Created 3 users");

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
    const assignedCollector = i < 6 ? collectors[i % 2] : null;
    const c = await prisma.customer.upsert({
      where: { id: ID.customers[i] },
      update: {},
      create: {
        id: ID.customers[i],
        name: customerNames[i],
        nickname: i === 0 ? "Ali" : null,
        phone: `+1809555${String(1000 + i)}`,
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
          kind: "INSTALLMENT",
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
  // Accounting: 4 accounts (zero balance), 11 categories (no transactions)
  // ---------------------------------------------------------------------------
  const accountSpecs = [
    { id: ID.accountingAccounts[0], name: "Cuenta de Recaudación", kind: "BANK" as const },
    { id: ID.accountingAccounts[1], name: "Cuenta Operativa", kind: "BANK" as const },
    { id: ID.accountingAccounts[2], name: "Caja General", kind: "CASH" as const },
    { id: ID.accountingAccounts[3], name: "Caja Chica", kind: "CASH" as const }
  ];

  for (const a of accountSpecs) {
    await prisma.accountingAccount.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id,
        name: a.name,
        kind: a.kind,
        currency: "DOP",
        openingBalance: 0,
        currentBalance: 0,
        isActive: true
      }
    });
  }
  console.log("Created 4 accounting accounts");

  const categorySpecs = [
    { name: "Alquiler", kind: "EXPENSE" as const },
    { name: "Energía Eléctrica", kind: "EXPENSE" as const },
    { name: "Agua", kind: "EXPENSE" as const },
    { name: "Combustible", kind: "EXPENSE" as const },
    { name: "Mantenimiento de Vehículos", kind: "EXPENSE" as const },
    { name: "Suministros de Oficina", kind: "EXPENSE" as const },
    { name: "Salarios", kind: "EXPENSE" as const },
    { name: "Comisiones de Referidos", kind: "EXPENSE" as const },
    { name: "Honorarios Contables y Legales", kind: "EXPENSE" as const },
    { name: "Comisiones Bancarias", kind: "EXPENSE" as const },
    { name: "Cargos Administrativos", kind: "INCOME" as const }
  ];

  for (let i = 0; i < categorySpecs.length; i++) {
    const c = categorySpecs[i];
    await prisma.accountingCategory.upsert({
      where: { id: ID.accountingCategories[i] },
      update: {},
      create: { id: ID.accountingCategories[i], name: c.name, kind: c.kind }
    });
  }
  console.log("Created 11 accounting categories");

  // ---------------------------------------------------------------------------
  // Loan applications (5) — one per review-lifecycle state, for the ops dashboard.
  // scoreData is hand-built to the ApplicationScore shape (kept import-free so the
  // seed stays decoupled from the @mikro/common barrel / resvg).
  // ---------------------------------------------------------------------------
  const CAT_WEIGHTS = [
    ["PAYMENT_CAPACITY", 30],
    ["BUSINESS_TYPE_RISK", 20],
    ["TRACK_RECORD_FORMALIZATION", 15],
    ["ROOTEDNESS_STABILITY", 15],
    ["SUPPORT_NETWORK", 10],
    ["LOAN_PURPOSE", 10]
  ] as const;

  type ScoreParams = {
    isc: number;
    band: string;
    rec: string;
    conf: string;
    cats: number[];
    amount: number;
    term: number;
    installment: number;
    sales: number;
    flags?: { code: string; message: string }[];
    notes: { topic: string; question: string; reason: string }[];
  };

  function buildScore(
    name: string,
    idDoc: string,
    phone: string,
    province: string,
    bizType: string,
    bizName: string,
    p: ScoreParams
  ) {
    return {
      name,
      age: null,
      id_document: idDoc,
      phone,
      business: { type_code: bizType, name: bizName, risk_level: p.band },
      province,
      isc: p.isc,
      risk_band: p.band,
      recommendation: p.rec,
      confidence: p.conf,
      flags: p.flags ?? [],
      categories: CAT_WEIGHTS.map(([category, weight], i) => ({
        category,
        weight,
        score: p.cats[i]
      })),
      indicators: {
        amount_requested: { value: p.amount, unit: "DOP" },
        term_weeks: { value: p.term, unit: "weeks" },
        monthly_installment: { value: p.installment, unit: "DOP" },
        monthly_sales: { value: p.sales, unit: "DOP" },
        net_income: { value: Math.round(p.sales * 0.3), unit: "DOP" },
        debt_service_ratio: { value: 0.25, unit: "ratio" }
      },
      evaluator_notes: p.notes
    };
  }

  const applicationSpecs = [
    {
      sessionId: "seed-app-1284",
      status: "RECEIVED",
      daysAgo: 1,
      firstName: "Juan",
      lastName: "Pérez García",
      phone: "+18095551001",
      idNumber: "001-1234567-8",
      maritalStatus: "Casado(a)",
      businessType: "Comerciante",
      businessName: "Colmado El Progreso",
      requestedAmount: 25000,
      purpose: "Compra de inventario / mercancía",
      requestedTermWeeks: 12,
      province: "Santiago",
      homeAddress: "Calle Duarte #45, Santiago",
      raw: {
        businessAge: "3 a 5 años",
        monthlySales: "RD$100,000 – RD$250,000",
        formalization: "Informal (sin RNC)",
        locationType: "Alquilado",
        employeeCount: "1 a 3",
        housingType: "Propia",
        residenceTime: "Más de 10 años",
        referenceName: "Distribuidora La Nacional",
        referencePhone: "+18095550199"
      },
      score: {
        isc: 82,
        band: "LOW_RISK",
        rec: "APPROVE",
        conf: "HIGH",
        cats: [85, 78, 80, 88, 75, 84],
        amount: 25000,
        term: 12,
        installment: 2340,
        sales: 175000,
        notes: [
          {
            topic: "VENTAS",
            question: "¿Las ventas mensuales se mantienen en temporada baja?",
            reason: "Evaluar variabilidad estacional."
          },
          {
            topic: "INVENTARIO",
            question: "¿Qué proveedores maneja y en qué plazo le pagan?",
            reason: "Capital de trabajo."
          }
        ]
      } as ScoreParams
    },
    {
      sessionId: "seed-app-1283",
      status: "IN_REVIEW",
      daysAgo: 2,
      firstName: "Elena",
      lastName: "Brito",
      phone: "+18095551002",
      idNumber: "031-0987654-1",
      maritalStatus: "Soltero(a)",
      businessType: "Salón de belleza",
      businessName: "Estética Elena",
      requestedAmount: 36000,
      purpose: "Equipamiento",
      requestedTermWeeks: 16,
      province: "Moca",
      homeAddress: "Av. Independencia #12, Moca",
      raw: {
        businessAge: "1 a 3 años",
        monthlySales: "RD$50,000 – RD$100,000",
        formalization: "Formal (con RNC)",
        locationType: "Propio",
        employeeCount: "1 a 3",
        housingType: "Alquilada",
        residenceTime: "5 a 10 años",
        referenceName: "María Tavárez",
        referencePhone: "+18095550188"
      },
      score: {
        isc: 74,
        band: "MODERATE_RISK",
        rec: "APPROVE_WITH_CONDITIONS",
        conf: "MEDIUM",
        cats: [70, 72, 68, 80, 70, 78],
        amount: 36000,
        term: 16,
        installment: 2600,
        sales: 78000,
        notes: [
          {
            topic: "ANTIGÜEDAD",
            question: "¿Cómo ha evolucionado la clientela en el último año?",
            reason: "Negocio relativamente nuevo."
          }
        ]
      } as ScoreParams
    },
    {
      sessionId: "seed-app-1282",
      status: "APPROVED",
      daysAgo: 4,
      firstName: "Ramón",
      lastName: "Tejada",
      phone: "+18095551003",
      idNumber: "001-5566778-9",
      maritalStatus: "Casado(a)",
      businessType: "Taller mecánico",
      businessName: "Auto Tejada",
      requestedAmount: 12000,
      purpose: "Herramientas",
      requestedTermWeeks: 10,
      province: "Santiago",
      homeAddress: "Calle 5 #30, Santiago",
      raw: {
        businessAge: "Más de 5 años",
        monthlySales: "RD$100,000 – RD$250,000",
        formalization: "Formal (con RNC)",
        locationType: "Propio",
        employeeCount: "4 a 6",
        housingType: "Propia",
        residenceTime: "Más de 10 años",
        referenceName: "Repuestos del Cibao",
        referencePhone: "+18095550177"
      },
      score: {
        isc: 88,
        band: "LOW_RISK",
        rec: "APPROVE",
        conf: "HIGH",
        cats: [90, 85, 88, 90, 82, 86],
        amount: 12000,
        term: 10,
        installment: 1320,
        sales: 190000,
        notes: []
      } as ScoreParams,
      reviewNote: "Buen historial, negocio formal estable."
    },
    {
      sessionId: "seed-app-1281",
      status: "SIGNED",
      daysAgo: 6,
      firstName: "María",
      lastName: "Rosario",
      phone: "+18095551004",
      idNumber: "001-2233445-6",
      maritalStatus: "Viudo(a)",
      businessType: "Repostería",
      businessName: "Dulces María",
      requestedAmount: 18000,
      purpose: "Capital de trabajo",
      requestedTermWeeks: 12,
      province: "Santiago",
      homeAddress: "Calle Restauración #88, Santiago",
      raw: {
        businessAge: "3 a 5 años",
        monthlySales: "RD$50,000 – RD$100,000",
        formalization: "Informal (sin RNC)",
        locationType: "Alquilado",
        employeeCount: "Solo yo",
        housingType: "Propia",
        residenceTime: "Más de 10 años",
        referenceName: "Panadería La Espiga",
        referencePhone: "+18095550166"
      },
      score: {
        isc: 79,
        band: "MODERATE_RISK",
        rec: "APPROVE",
        conf: "HIGH",
        cats: [78, 75, 80, 85, 72, 82],
        amount: 18000,
        term: 12,
        installment: 1700,
        sales: 72000,
        notes: []
      } as ScoreParams,
      reviewNote: "Aprobada; contrato firmado en archivo.",
      contract: true
    },
    {
      sessionId: "seed-app-1280",
      status: "REJECTED",
      daysAgo: 7,
      firstName: "Ana",
      lastName: "Luna",
      phone: "+18095551005",
      idNumber: "402-1122334-5",
      maritalStatus: "Soltero(a)",
      businessType: "Venta ambulante",
      businessName: "Ventas Ana",
      requestedAmount: 45000,
      purpose: "Compra de mercancía",
      requestedTermWeeks: 20,
      province: "La Vega",
      homeAddress: "Sector El Ranchito, La Vega",
      raw: {
        businessAge: "Menos de 1 año",
        monthlySales: "Menos de RD$50,000",
        formalization: "Informal (sin RNC)",
        locationType: "Ambulante",
        employeeCount: "Solo yo",
        housingType: "Alquilada",
        residenceTime: "1 a 3 años",
        referenceName: "—",
        referencePhone: "—"
      },
      score: {
        isc: 41,
        band: "HIGH_RISK",
        rec: "REJECT",
        conf: "MEDIUM",
        cats: [35, 40, 30, 45, 50, 48],
        amount: 45000,
        term: 20,
        installment: 2700,
        sales: 38000,
        flags: [{ code: "INCOMPLETE_DATA", message: "Sin referencias verificables." }],
        notes: [
          {
            topic: "CAPACIDAD",
            question: "¿Cómo cubriría la cuota en meses de baja venta?",
            reason: "Monto alto frente a ventas."
          }
        ]
      } as ScoreParams,
      reviewNote: "Monto solicitado muy alto frente a la capacidad de pago; sin referencias."
    },
    // Incomplete draft (partial submission) — primary target for manual purge.
    {
      sessionId: "seed-app-draft-9001",
      status: "DRAFT",
      daysAgo: 3,
      firstName: "Pedro",
      lastName: "Núñez",
      phone: "+18095551006",
      idNumber: "402-7654321-0",
      maritalStatus: "Soltero(a)",
      businessType: "Colmado",
      businessName: "Colmado Núñez",
      requestedAmount: 30000,
      purpose: "Capital de trabajo",
      requestedTermWeeks: 12,
      province: "Puerto Plata",
      homeAddress: "Calle Principal, Puerto Plata",
      raw: {
        businessAge: "1 a 3 años",
        monthlySales: "RD$50,000 – RD$100,000"
      },
      score: null
    }
  ];

  const now = Date.now();
  const day = 86_400_000;
  for (const a of applicationSpecs) {
    const createdAt = new Date(now - a.daysAgo * day);
    const reviewed = ["IN_REVIEW", "APPROVED", "SIGNED", "REJECTED", "CONVERTED"].includes(
      a.status
    );
    const sd = a.score
      ? buildScore(
          `${a.firstName} ${a.lastName}`,
          a.idNumber,
          a.phone,
          a.province,
          a.businessType,
          a.businessName,
          a.score
        )
      : null;
    const create = {
      sessionId: a.sessionId,
      status: a.status as never,
      firstName: a.firstName,
      lastName: a.lastName,
      phone: a.phone,
      idNumber: a.idNumber,
      maritalStatus: a.maritalStatus,
      businessType: a.businessType,
      businessName: a.businessName,
      requestedAmount: a.requestedAmount,
      purpose: a.purpose,
      requestedTermWeeks: a.requestedTermWeeks,
      province: a.province,
      homeAddress: a.homeAddress,
      rawData: a.raw as never,
      scoreData: sd as never,
      score: a.score?.isc ?? null,
      riskBand: a.score?.band ?? null,
      recommendation: a.score?.rec ?? null,
      scoredAt: a.score ? createdAt : null,
      submittedAt: a.status === "DRAFT" ? null : createdAt,
      createdAt,
      ...(reviewed ? { reviewedById: admin.id, reviewedAt: createdAt } : {}),
      ...("reviewNote" in a && a.reviewNote ? { reviewNote: a.reviewNote } : {}),
      ...("contract" in a && a.contract
        ? {
            contractFilename: `${a.sessionId}.pdf`,
            contractOriginalName: "contrato-firmado.pdf",
            contractMimeType: "application/pdf",
            contractSize: 120_000,
            contractSha256: "seed-placeholder",
            signedById: admin.id,
            signedAt: createdAt
          }
        : {})
    };
    await prisma.loanApplication.upsert({
      where: { sessionId: a.sessionId },
      update: { status: a.status as never },
      create
    });
  }
  console.log(`Created ${applicationSpecs.length} loan applications`);

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
