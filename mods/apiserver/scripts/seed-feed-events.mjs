/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Dev-only seeder for the founder feed: exercises REAL tRPC mutations through
 * appRouter.createCaller so events flow through the event-capture middleware
 * exactly as they do in production — nothing is inserted into business_events
 * directly. Run against the dev database only:
 *
 *   npm run build && node scripts/seed-feed-events.mjs
 *
 * After seeding it backdates a few event timestamps (raw SQL, dev-only) so the
 * feed shows Hoy/Ayer/older day groups instead of one giant "Hoy".
 */
/* global console, process */
import { appRouter } from "../dist/trpc/routers/index.js";
import { prisma } from "../dist/db.js";

const results = [];
const step = async (label, fn) => {
  try {
    const out = await fn();
    results.push(`✓ ${label}`);
    return out;
  } catch (err) {
    results.push(`✗ ${label} — ${err.message?.slice(0, 120)}`);
    return null;
  }
};

const callerFor = (user, roles) =>
  appRouter.createCaller({ db: prisma, isAuthenticated: true, userId: user.id, roles });

const admin = await prisma.user.findFirst({
  where: { roles: { some: { role: "ADMIN" } } }
});
if (!admin) {
  console.error("No ADMIN user in this database; aborting.");
  process.exit(1);
}
const adminCaller = callerFor(admin, ["ADMIN"]);

// --- Payments on active loans, collected by each loan's assigned collector ---
const loans = await prisma.loan.findMany({
  where: { status: "ACTIVE" },
  include: { customer: true },
  take: 5
});
for (const loan of loans) {
  const collectorId = loan.customer.assignedCollectorId ?? admin.id;
  const collector = (await prisma.user.findUnique({ where: { id: collectorId } })) ?? admin;
  const caller = callerFor(collector, [
    "COLLECTOR",
    ...(collector.id === admin.id ? ["ADMIN"] : [])
  ]);
  await step(`payment on loan #${loan.loanId} (${loan.customer.name})`, () =>
    caller.createPayment({
      loanId: loan.loanId,
      amount: Number(loan.paymentAmount ?? 500),
      collectedById: collector.id,
      notes: "Seed: cobro de ruta"
    })
  );
}

// --- Reverse the last seeded payment (payment.reversed card) ---
const lastPayment = await prisma.payment.findFirst({
  where: { status: { not: "REVERSED" } },
  orderBy: { paidAt: "desc" }
});
if (lastPayment) {
  await step("reverse one payment", () =>
    adminCaller.reversePayment({ id: lastPayment.id, notes: "Seed: monto incorrecto" })
  );
}

// --- Application review events ---
const inReview = await prisma.loanApplication.findFirst({ where: { status: "IN_REVIEW" } });
if (inReview) {
  await step(`approve application ${inReview.id.slice(0, 8)}`, () =>
    adminCaller.approveApplication({ id: inReview.id, note: "Seed: perfil sólido" })
  );
}

// --- New customers (customer.created cards) ---
const stamp = Date.now() % 10000;
const collectors = await prisma.user.findMany({
  where: { roles: { some: { role: "COLLECTOR" } } },
  take: 1
});
for (const [i, name] of ["Ramona Núñez", "Pedro Castillo"].entries()) {
  await step(`create customer ${name}`, () =>
    adminCaller.createCustomer({
      name,
      phone: `+180955${String(stamp + i).padStart(5, "0")}`,
      idNumber: `002-00${String(stamp + i).padStart(5, "0")}-${i}`,
      homeAddress: "Av. Duarte 45, Santiago",
      assignedCollectorId: collectors[0]?.id ?? admin.id
    })
  );
}

// --- Delete a draft application (red card + Restaurar) ---
const draft = await prisma.loanApplication.findFirst({ where: { status: "DRAFT" } });
if (draft) {
  await step(`delete draft application ${draft.id.slice(0, 8)}`, () =>
    adminCaller.deleteApplication({ id: draft.id })
  );
}

// --- Loan status change ---
const toComplete = await prisma.loan.findFirst({
  where: { status: "ACTIVE" },
  orderBy: { createdAt: "asc" }
});
if (toComplete) {
  await step(`complete loan #${toComplete.loanId}`, () =>
    adminCaller.updateLoanStatus({ loanId: toComplete.loanId, status: "COMPLETED" })
  );
}

// --- Spread events across days so the feed shows day groups (dev-only) ---
const events = await prisma.businessEvent.findMany({ orderBy: { occurredAt: "desc" } });
const day = 24 * 60 * 60 * 1000;
const offsets = [0, 0, 0, 1, 1, 1, 2, 2, 3, 4];
await step("backdate events across recent days", async () => {
  for (const [i, ev] of events.entries()) {
    const offset = offsets[i % offsets.length] * day + i * 7 * 60 * 1000;
    await prisma.$executeRaw`UPDATE business_events SET occurred_at = ${new Date(Date.now() - offset)} WHERE id = ${ev.id}`;
  }
});

console.log("\nSeed results:");
for (const r of results) console.log(" ", r);
const count = await prisma.businessEvent.count();
console.log(`\nbusiness_events total: ${count}`);
process.exit(0);
