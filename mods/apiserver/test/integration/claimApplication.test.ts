/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Integration tests for claimApplication's assign-to-another-reviewer path.
 * `assigneeId` defaults to the caller (self-claim, open to REVIEWER/ADMIN) but
 * reassigning to someone else is ADMIN-only, and the assignee must actually be
 * a reviewer or admin.
 */
import { expect } from "chai";
import {
  createTestDb,
  createAuthenticatedCaller,
  applySchema,
  type TestDb,
  type AuthenticatedCaller
} from "./setup.js";
import { appRouter } from "../../src/trpc/index.js";

describe("claimApplication assignment", () => {
  let db: TestDb;
  let admin: AuthenticatedCaller;
  let phoneSeq = 0;
  const uniquePhone = () => {
    phoneSeq += 1;
    return `+1809${String(10_000_000 + phoneSeq).slice(1)}`;
  };

  before(async () => {
    db = createTestDb();
    await applySchema(db);
  });

  beforeEach(async () => {
    await db.loanApplication.deleteMany();
    await db.userRole.deleteMany();
    await db.user.deleteMany();
    admin = createAuthenticatedCaller(db);
  });

  after(async () => {
    await db.$disconnect();
  });

  async function makeApplication() {
    return db.loanApplication.create({
      data: {
        sessionId: `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        status: "RECEIVED",
        source: "MANUAL",
        firstName: "Pedro",
        lastName: "Martínez",
        phone: uniquePhone(),
        idNumber: "001-1234567-8",
        homeAddress: "Calle 2",
        rawData: { any: "thing" } as any
      }
    });
  }

  function callerAs(userId: string, roles: Array<"ADMIN" | "COLLECTOR" | "REVIEWER">) {
    return appRouter.createCaller({ db: db as any, isAuthenticated: true, userId, roles });
  }

  async function expectRejected(promise: Promise<unknown>, code: string) {
    let thrown: { code?: string } | undefined;
    try {
      await promise;
    } catch (err) {
      thrown = err as { code?: string };
    }
    expect(thrown, "expected a rejection").to.not.equal(undefined);
    expect(thrown!.code).to.equal(code);
  }

  it("lets a reviewer self-claim without assigneeId", async () => {
    const reviewer = await admin.createUser({
      name: "Reviewer One",
      phone: uniquePhone(),
      role: "REVIEWER"
    });
    const app = await makeApplication();
    const reviewerCaller = callerAs(reviewer.id, ["REVIEWER"]);

    const updated = await reviewerCaller.claimApplication({ id: app.id });

    expect(updated.status).to.equal("IN_REVIEW");
    expect(updated.reviewedById).to.equal(reviewer.id);
  });

  it("rejects a reviewer assigning to someone else", async () => {
    const reviewer = await admin.createUser({
      name: "Reviewer Two",
      phone: uniquePhone(),
      role: "REVIEWER"
    });
    const other = await admin.createUser({
      name: "Reviewer Three",
      phone: uniquePhone(),
      role: "REVIEWER"
    });
    const app = await makeApplication();
    const reviewerCaller = callerAs(reviewer.id, ["REVIEWER"]);

    await expectRejected(
      reviewerCaller.claimApplication({ id: app.id, assigneeId: other.id }),
      "FORBIDDEN"
    );
  });

  it("lets an admin assign to another reviewer", async () => {
    const target = await admin.createUser({
      name: "Reviewer Four",
      phone: uniquePhone(),
      role: "REVIEWER"
    });
    const app = await makeApplication();

    const updated = await admin.claimApplication({ id: app.id, assigneeId: target.id });

    expect(updated.status).to.equal("IN_REVIEW");
    expect(updated.reviewedById).to.equal(target.id);
  });

  it("rejects assigning to a user without reviewer/admin role", async () => {
    const collector = await admin.createUser({
      name: "Collector One",
      phone: uniquePhone(),
      role: "COLLECTOR"
    });
    const app = await makeApplication();

    await expectRejected(
      admin.claimApplication({ id: app.id, assigneeId: collector.id }),
      "BAD_REQUEST"
    );
  });

  it("rejects assigning to a nonexistent user", async () => {
    const app = await makeApplication();

    await expectRejected(
      admin.claimApplication({ id: app.id, assigneeId: "99999999-9999-4999-8999-999999999999" }),
      "BAD_REQUEST"
    );
  });
});
