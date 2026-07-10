/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Regression coverage for mikro/#41: every customer must have an assigned
 * collector. Enforced at the DB (NOT NULL), Zod (required uuid), and here at
 * the tRPC boundary for both customer creation and application conversion.
 */
import path from "path";
import { fileURLToPath } from "url";
import { expect } from "chai";
import { clearConfigCache } from "@mikro/common";
import {
  createTestDb,
  createAuthenticatedCaller,
  applySchema,
  type TestDb,
  type AuthenticatedCaller
} from "./setup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Must match test/fixtures/mikro.json's accounting.disbursementAccountId, and
// the fixed userId createAuthenticatedCaller sets as ctx.userId (mikro/#155:
// disbursement transactions require a real account + a real creator user).
const DISBURSEMENT_ACCOUNT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
const REVIEWER_ID = "00000000-0000-4000-8000-000000000001";

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
    await db.accountingAccount.create({
      data: {
        id: DISBURSEMENT_ACCOUNT_ID,
        name: "Caja principal (test)",
        kind: "CASH",
        currentBalance: 100_000
      }
    });
  });

  beforeEach(async () => {
    await db.accountingTransaction.deleteMany();
    await db.loanApplication.deleteMany();
    await db.loan.deleteMany();
    await db.customer.deleteMany();
    await db.userRole.deleteMany();
    await db.user.deleteMany();
    await db.user.create({
      data: { id: REVIEWER_ID, name: "Reviewer de prueba", phone: uniquePhone() }
    });
    await db.accountingAccount.update({
      where: { id: DISBURSEMENT_ACCOUNT_ID },
      data: { currentBalance: 100_000 }
    });
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

  describe("auto-disbursement (mikro/#155)", () => {
    it("posts a WITHDRAWAL transaction for the principal and decrements the account balance", async () => {
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

      expect(result.disbursement).to.not.equal(undefined);
      expect(result.disbursement!.amount).to.equal(5000);
      expect(result.disbursement!.accountId).to.equal(DISBURSEMENT_ACCOUNT_ID);

      const txn = await db.accountingTransaction.findUnique({
        where: { id: result.disbursement!.transactionId }
      });
      expect(txn).to.not.equal(null);
      expect(txn!.type).to.equal("WITHDRAWAL");
      expect(Number(txn!.amount)).to.equal(5000);
      expect(txn!.categoryId).to.equal(null);
      expect(txn!.createdById).to.equal(REVIEWER_ID);

      const account = await db.accountingAccount.findUnique({
        where: { id: DISBURSEMENT_ACCOUNT_ID }
      });
      expect(Number(account!.currentBalance)).to.equal(95_000);
    });

    it("creates nothing when the server config has no disbursement account set", async () => {
      const collector = await makeCollector();
      const app = await makeApplication();

      const originalConfigFile = process.env.MIKRO_CONFIG_FILE;
      process.env.MIKRO_CONFIG_FILE = path.resolve(
        __dirname,
        "../fixtures/mikro-no-disbursement.json"
      );
      clearConfigCache();

      let thrown: unknown;
      try {
        await caller.convertApplication({
          id: app.id,
          principal: 5000,
          termLength: 10,
          paymentAmount: 650,
          paymentFrequency: "WEEKLY",
          assignedCollectorId: collector.id
        });
      } catch (err) {
        thrown = err;
      } finally {
        process.env.MIKRO_CONFIG_FILE = originalConfigFile;
        clearConfigCache();
      }

      expect(thrown).to.not.equal(undefined);
      expect(await db.loan.count()).to.equal(0);
      expect(await db.accountingTransaction.count()).to.equal(0);
      const unchangedApp = await db.loanApplication.findUnique({ where: { id: app.id } });
      expect(unchangedApp!.status).to.equal("SIGNED");
    });
  });

  describe("document migration onto the resulting customer", () => {
    it("copies the application's stored contract and ID images as CustomerDocument rows", async () => {
      const collector = await makeCollector();
      const app = await makeApplication({
        contractFilename: "aaa111.pdf",
        contractOriginalName: "contrato.pdf",
        contractMimeType: "application/pdf",
        contractSize: 12_345,
        idFrontFilename: "bbb222.jpg",
        idFrontOriginalName: "cedula-frente.jpg",
        idFrontMimeType: "image/jpeg",
        idFrontSize: 5_000,
        idBackFilename: "ccc333.jpg",
        idBackOriginalName: "cedula-atras.jpg",
        idBackMimeType: "image/jpeg",
        idBackSize: 5_100
      });

      const result = await caller.convertApplication({
        id: app.id,
        principal: 5000,
        termLength: 10,
        paymentAmount: 650,
        paymentFrequency: "WEEKLY",
        assignedCollectorId: collector.id
      });

      const docs = await db.customerDocument.findMany({
        where: { customerId: result.customerId },
        orderBy: { type: "asc" }
      });
      expect(docs).to.have.lengthOf(3);

      const contract = docs.find((d) => d.type === "CONTRACT")!;
      expect(contract.filename).to.equal("aaa111.pdf");
      expect(contract.sha256).to.equal("aaa111");
      expect(contract.source).to.equal("MIGRATED_FROM_APPLICATION");
      expect(contract.originalName).to.equal("contrato.pdf");

      const idFront = docs.find((d) => d.type === "ID_FRONT")!;
      expect(idFront.filename).to.equal("bbb222.jpg");
      expect(idFront.sha256).to.equal("bbb222");

      const idBack = docs.find((d) => d.type === "ID_BACK")!;
      expect(idBack.filename).to.equal("ccc333.jpg");
      expect(idBack.sha256).to.equal("ccc333");

      // The application's own document columns are untouched by the migration.
      const unchangedApp = await db.loanApplication.findUnique({ where: { id: app.id } });
      expect(unchangedApp!.contractFilename).to.equal("aaa111.pdf");
      expect(unchangedApp!.idFrontFilename).to.equal("bbb222.jpg");
      expect(unchangedApp!.idBackFilename).to.equal("ccc333.jpg");
    });

    it("migrates nothing when the application has no stored documents", async () => {
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

      const docs = await db.customerDocument.findMany({
        where: { customerId: result.customerId }
      });
      expect(docs).to.have.lengthOf(0);
    });

    it("leaves no CustomerDocument rows when conversion fails and rolls back", async () => {
      const collector = await makeCollector();
      const app = await makeApplication({
        contractFilename: "ddd444.pdf",
        contractOriginalName: "contrato.pdf",
        contractMimeType: "application/pdf",
        contractSize: 999
      });

      const originalConfigFile = process.env.MIKRO_CONFIG_FILE;
      process.env.MIKRO_CONFIG_FILE = path.resolve(
        __dirname,
        "../fixtures/mikro-no-disbursement.json"
      );
      clearConfigCache();

      let thrown: unknown;
      try {
        await caller.convertApplication({
          id: app.id,
          principal: 5000,
          termLength: 10,
          paymentAmount: 650,
          paymentFrequency: "WEEKLY",
          assignedCollectorId: collector.id
        });
      } catch (err) {
        thrown = err;
      } finally {
        process.env.MIKRO_CONFIG_FILE = originalConfigFile;
        clearConfigCache();
      }

      expect(thrown).to.not.equal(undefined);
      expect(await db.customerDocument.count()).to.equal(0);
    });
  });
});
