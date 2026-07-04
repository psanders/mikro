/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Regression coverage for mikro/#41: every customer must have an assigned
 * collector. Enforced at the DB (NOT NULL), Zod (required uuid), and here at
 * the tRPC boundary for both customer creation and application conversion.
 */
import { expect } from "chai";
import {
  createTestDb,
  createAuthenticatedCaller,
  applySchema,
  type TestDb,
  type AuthenticatedCaller
} from "./setup.js";

describe("convertApplication collector assignment", () => {
  let db: TestDb;
  let caller: AuthenticatedCaller;
  let phoneSeq = 0;
  const uniquePhone = () => {
    phoneSeq += 1;
    return `+1809${String(10_000_000 + phoneSeq).slice(1)}`;
  };
  let idSeq = 0;
  const uniqueIdNumber = () => {
    idSeq += 1;
    return `001-${String(1_000_000 + idSeq).slice(-7)}-9`;
  };

  before(async () => {
    db = createTestDb();
    await applySchema(db);
  });

  beforeEach(async () => {
    await db.loanApplication.deleteMany();
    await db.loan.deleteMany();
    await db.customer.deleteMany();
    await db.userRole.deleteMany();
    await db.user.deleteMany();
    caller = createAuthenticatedCaller(db);
  });

  after(async () => {
    await db.$disconnect();
  });

  async function makeCollector(name = "María Collector") {
    return caller.createUser({ name, phone: uniquePhone(), role: "COLLECTOR" });
  }

  async function makeApplication(overrides: Record<string, unknown> = {}) {
    return db.loanApplication.create({
      data: {
        sessionId: `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        status: "SIGNED",
        source: "MANUAL",
        firstName: "Pedro",
        lastName: "Martínez",
        phone: uniquePhone(),
        idNumber: uniqueIdNumber(),
        homeAddress: "Calle 2",
        rawData: { any: "thing" } as any,
        ...overrides
      }
    });
  }

  it("assigns the picked collector to a newly created customer", async () => {
    const collector = await makeCollector();
    const app = await makeApplication();

    const result = await caller.convertApplication({
      id: app.id,
      principal: 5000,
      termLength: 10,
      paymentAmount: 650,
      paymentFrequency: "WEEKLY",
      assignedCollectorId: collector.id
    });

    const customer = await db.customer.findUnique({ where: { id: result.customerId } });
    expect(customer!.assignedCollectorId).to.equal(collector.id);
  });

  it("does not overwrite a reused customer's existing collector", async () => {
    const originalCollector = await makeCollector("Original Collector");
    const otherCollector = await makeCollector("Other Collector");
    const idNumber = uniqueIdNumber();
    const existing = await caller.createCustomer({
      name: "Juana Pérez",
      phone: uniquePhone(),
      idNumber,
      homeAddress: "Calle 1",
      assignedCollectorId: originalCollector.id
    });
    const app = await makeApplication({ idNumber, phone: existing.phone });

    await caller.convertApplication({
      id: app.id,
      principal: 5000,
      termLength: 10,
      paymentAmount: 650,
      paymentFrequency: "WEEKLY",
      assignedCollectorId: otherCollector.id
    });

    const customer = await db.customer.findUnique({ where: { id: existing.id } });
    expect(customer!.assignedCollectorId).to.equal(originalCollector.id);
  });

  it("rejects converting an application with no collector picked", async () => {
    const app = await makeApplication();

    let thrown: unknown;
    try {
      await caller.convertApplication({
        id: app.id,
        principal: 5000,
        termLength: 10,
        paymentAmount: 650,
        paymentFrequency: "WEEKLY"
      } as any);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).to.not.equal(undefined);
    expect(await db.customer.count()).to.equal(0);
  });

  it("rejects creating a customer with no collector picked", async () => {
    let thrown: unknown;
    try {
      await caller.createCustomer({
        name: "Juana Pérez",
        phone: uniquePhone(),
        idNumber: uniqueIdNumber(),
        homeAddress: "Calle 1"
      } as any);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).to.not.equal(undefined);
    expect(await db.customer.count()).to.equal(0);
  });
});
