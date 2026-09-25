/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Deterministic seed for the Ops app's Playwright suite (mods/dashboard/e2e).
 * Runs against the throwaway database named by MIKRO_CONFIG_FILE (never the
 * dev/prod one) after `prisma migrate deploy`. Every application reaches its
 * state through the REAL review procedures (appRouter.createCaller), so the
 * seeded data is exactly what the flow would produce — events included.
 *
 *   MIKRO_CONFIG_FILE=…/mods/dashboard/e2e/mikro.e2e.json node scripts/seed-e2e.mjs
 *
 * Seeds (all passwords "e2e-pass"):
 *   admin  +18292000001  Pedro Admin      ADMIN
 *   ana    +18292000002  Ana Evaluadora   REVIEWER
 *   luis   +18292000003  Luis Evaluador   REVIEWER
 *   miguel +18292000004  Miguel Cobrador  COLLECTOR
 * Applications (by business name): Colmado Cola (RECEIVED ×2 with Frutería Cola),
 * Salón Pendiente + Taller Pendiente (PENDING_DECISION), Ferretería Aprobada
 * (APPROVED, contract generated + signed, assigned to Ana), Tienda de Luis
 * (IN_REVIEW, assigned to Luis).
 */
/* global console, process, Buffer */
import bcrypt from "bcryptjs";
import { appRouter } from "../dist/trpc/routers/index.js";
import { prisma } from "../dist/db.js";

const PASSWORD = "e2e-pass";
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n").toString("base64");

const USERS = {
  admin: {
    id: "00000000-0000-4000-8000-0000000000a1",
    name: "Pedro Admin",
    phone: "+18292000001",
    role: "ADMIN"
  },
  ana: {
    id: "00000000-0000-4000-8000-0000000000a2",
    name: "Ana Evaluadora",
    phone: "+18292000002",
    role: "REVIEWER"
  },
  luis: {
    id: "00000000-0000-4000-8000-0000000000a3",
    name: "Luis Evaluador",
    phone: "+18292000003",
    role: "REVIEWER"
  },
  miguel: {
    id: "00000000-0000-4000-8000-0000000000a4",
    name: "Miguel Cobrador",
    phone: "+18292000004",
    role: "COLLECTOR"
  }
};

const hash = await bcrypt.hash(PASSWORD, 10);
for (const u of Object.values(USERS)) {
  await prisma.user.create({ data: { id: u.id, name: u.name, phone: u.phone, password: hash } });
  await prisma.userRole.create({ data: { userId: u.id, role: u.role } });
}
await prisma.accountingAccount.create({
  data: {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
    name: "Caja General",
    kind: "CASH",
    currentBalance: 100000
  }
});
await prisma.accountingAccount.create({
  data: {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2",
    name: "Cuenta de Recaudación",
    kind: "BANK",
    currentBalance: 250000
  }
});

const as = (user) =>
  appRouter.createCaller({
    db: prisma,
    isAuthenticated: true,
    userId: user.id,
    roles: [user.role]
  });
const admin = as(USERS.admin);
const ana = as(USERS.ana);
const luis = as(USERS.luis);

let seq = 0;
async function received(firstName, lastName, businessName) {
  seq += 1;
  return admin.createApplication({
    patch: {
      firstName,
      lastName,
      phone: `(809) 555-${String(1000 + seq)}`,
      idNumber: `031-${String(1000000 + seq)}-2`,
      homeAddress: "C/ Duarte #45",
      businessName,
      businessType: "COLMADO",
      requestedAmount: "15,000",
      requestedTermWeeks: "12 semanas",
      province: "PUERTO_PLATA"
    },
    sendPromo: false
  });
}

async function withEvidence(caller, id) {
  await caller.setApplicationMapUrl({
    id,
    mapUrl: "https://maps.google.com/?q=19.793412,-70.688401"
  });
  await caller.uploadIdImage({
    id,
    side: "FRONT",
    originalName: "f.png",
    mimeType: "image/png",
    dataBase64: PNG
  });
  await caller.uploadIdImage({
    id,
    side: "BACK",
    originalName: "b.png",
    mimeType: "image/png",
    dataBase64: PNG
  });
  for (const label of ["Fachada", "Interior", "Mercancía"]) {
    await caller.uploadApplicationDocument({
      id,
      kind: "BUSINESS_PHOTO",
      label,
      originalName: `${label}.png`,
      mimeType: "image/png",
      dataBase64: PNG
    });
  }
  await caller.setApplicationRecommendation({
    id,
    reviewerRecommendation: "Aprobar RD$10,000 a 10 semanas"
  });
}

// Queue: two new applications nobody has taken.
await received("Yokasta", "Díaz", "Colmado Cola");
await received("Carlos", "Ureña", "Frutería Cola");

// Two waiting for the admin's decision (evaluated by Ana).
for (const [first, last, biz] of [
  ["Rosa", "Pérez", "Salón Pendiente"],
  ["Julio", "Mena", "Taller Pendiente"]
]) {
  const app = await received(first, last, biz);
  await ana.assignApplication({ id: app.id });
  await withEvidence(ana, app.id);
  await ana.sendApplicationToDecision({ id: app.id });
}

// Approved, contract generated and signed: ready to disburse (Ana).
{
  const app = await received("Rafael", "Peña", "Ferretería Aprobada");
  await ana.assignApplication({ id: app.id });
  await withEvidence(ana, app.id);
  await ana.sendApplicationToDecision({ id: app.id });
  await admin.approveApplication({ id: app.id, approvedAmount: 10000, approvedTermWeeks: 10 });
  await ana.generateApplicationContract({
    id: app.id,
    installments: 10,
    installmentAmount: 1300,
    frequency: "WEEKLY",
    startDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  });
  await ana.uploadSignedContract({
    id: app.id,
    originalName: "contrato.pdf",
    mimeType: "application/pdf",
    dataBase64: PDF
  });
}

// A contract signed before this flow, as the migration leaves it: APPROVED with
// the signed PDF but no stored contract terms, and an old form that never
// recorded an amount (Ana).
{
  const app = await received("Ángel", "Jiménez", "Contrato Antiguo");
  await ana.assignApplication({ id: app.id });
  await withEvidence(ana, app.id);
  await ana.sendApplicationToDecision({ id: app.id });
  await admin.approveApplication({ id: app.id, approvedAmount: 8000, approvedTermWeeks: 10 });
  await ana.generateApplicationContract({
    id: app.id,
    installments: 10,
    installmentAmount: 1000,
    frequency: "WEEKLY",
    startDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  });
  await ana.uploadSignedContract({
    id: app.id,
    originalName: "contrato-viejo.pdf",
    mimeType: "application/pdf",
    dataBase64: PDF
  });
  await prisma.$executeRawUnsafe(
    "UPDATE loan_applications SET contract_terms = NULL, approved_amount = NULL, approved_term_weeks = NULL WHERE id = ?",
    app.id
  );
}

// In review with Luis — must NOT appear in Ana's feed.
{
  const app = await received("Luisa", "Mejía", "Tienda de Luis");
  await luis.assignApplication({ id: app.id });
}

console.log("e2e seed complete");
await prisma.$disconnect();
process.exit(0);
