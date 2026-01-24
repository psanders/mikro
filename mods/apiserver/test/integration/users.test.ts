/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Integration tests for user procedures.
 * Tests happy paths for user CRUD operations.
 */
import { expect } from "chai";
import {
  createTestDb,
  createAuthenticatedCaller,
  applySchema,
  type TestDb,
  type AuthenticatedCaller
} from "./setup.js";

describe("Users Integration", () => {
  let db: TestDb;
  let caller: AuthenticatedCaller;

  before(async () => {
    db = createTestDb();
    await applySchema(db);
  });

  beforeEach(async () => {
    // Clean tables between tests (order matters due to foreign keys)
    await db.message.deleteMany();
    await db.payment.deleteMany();
    await db.loan.deleteMany();
    await db.member.deleteMany();
    await db.userRole.deleteMany();
    await db.user.deleteMany();
    caller = createAuthenticatedCaller(db);
  });

  after(async () => {
    await db.$disconnect();
  });

  describe("createUser", () => {
    it("should create a user with name and phone", async () => {
      const input = {
        name: "John Admin",
        phone: "+18091234567"
      };

      const user = await caller.createUser(input);

      expect(user.id).to.be.a("string");
      expect(user.name).to.equal(input.name);
      expect(user.phone).to.equal(input.phone); // Phone is not normalized in createUser
      expect(user.enabled).to.equal(true);
    });

    it("should create a user with ADMIN role", async () => {
      const input = {
        name: "Admin User",
        phone: "+18091234568",
        role: "ADMIN" as const
      };

      const user = await caller.createUser(input);

      expect(user.name).to.equal(input.name);

      // Verify role was created by querying the database directly
      const roles = await db.userRole.findMany({
        where: { userId: user.id }
      });
      expect(roles).to.have.lengthOf(1);
      expect(roles[0].role).to.equal("ADMIN");
    });

    it("should create a user with COLLECTOR role", async () => {
      const input = {
        name: "Collector User",
        phone: "+18091234569",
        role: "COLLECTOR" as const
      };

      const user = await caller.createUser(input);

      // Verify role was created by querying the database directly
      const roles = await db.userRole.findMany({
        where: { userId: user.id }
      });
      expect(roles).to.have.lengthOf(1);
      expect(roles[0].role).to.equal("COLLECTOR");
    });

    it("should create a user with REFERRER role", async () => {
      const input = {
        name: "Referrer User",
        phone: "+18091234570",
        role: "REFERRER" as const
      };

      const user = await caller.createUser(input);

      // Verify role was created by querying the database directly
      const roles = await db.userRole.findMany({
        where: { userId: user.id }
      });
      expect(roles).to.have.lengthOf(1);
      expect(roles[0].role).to.equal("REFERRER");
    });
  });

  describe("getUser", () => {
    it("should retrieve a user by ID", async () => {
      const created = await caller.createUser({
        name: "Test User",
        phone: "+18091234571",
        role: "ADMIN"
      });

      const fetched = await caller.getUser({ id: created.id });

      expect(fetched).to.not.be.null;
      expect(fetched!.id).to.equal(created.id);
      expect(fetched!.name).to.equal(created.name);
      expect(fetched!.phone).to.equal(created.phone);
    });

    it("should return null for non-existent user", async () => {
      const result = await caller.getUser({
        id: "550e8400-e29b-41d4-a716-446655440000"
      });

      expect(result).to.be.null;
    });
  });

  describe("updateUser", () => {
    it("should update user name", async () => {
      const created = await caller.createUser({
        name: "Original Name",
        phone: "+18091234572"
      });

      const updated = await caller.updateUser({
        id: created.id,
        name: "Updated Name"
      });

      expect(updated.name).to.equal("Updated Name");
      expect(updated.phone).to.equal(created.phone); // Unchanged
    });

    it("should update user phone", async () => {
      const created = await caller.createUser({
        name: "Phone Test",
        phone: "+18091234573"
      });

      const updated = await caller.updateUser({
        id: created.id,
        phone: "+18091234574"
      });

      expect(updated.phone).to.equal("18091234574"); // Normalized (stripped +)
      expect(updated.name).to.equal(created.name); // Unchanged
    });

    it("should disable a user", async () => {
      const created = await caller.createUser({
        name: "Enabled User",
        phone: "+18091234575"
      });

      expect(created.enabled).to.equal(true);

      const updated = await caller.updateUser({
        id: created.id,
        enabled: false
      });

      expect(updated.enabled).to.equal(false);
    });

    it("should re-enable a disabled user", async () => {
      const created = await caller.createUser({
        name: "Toggle User",
        phone: "+18091234576"
      });

      // Disable first
      await caller.updateUser({
        id: created.id,
        enabled: false
      });

      // Re-enable
      const updated = await caller.updateUser({
        id: created.id,
        enabled: true
      });

      expect(updated.enabled).to.equal(true);
    });

    it("should update multiple fields at once", async () => {
      const created = await caller.createUser({
        name: "Multi Update",
        phone: "+18091234577"
      });

      const updated = await caller.updateUser({
        id: created.id,
        name: "New Name",
        phone: "+18091234578",
        enabled: false
      });

      expect(updated.name).to.equal("New Name");
      expect(updated.phone).to.equal("18091234578"); // Normalized (stripped +)
      expect(updated.enabled).to.equal(false);
    });
  });
});
