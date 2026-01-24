/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Integration tests for member procedures.
 * Tests happy paths for all member CRUD operations.
 */
import { expect } from "chai";
import {
  createTestDb,
  createAuthenticatedCaller,
  applySchema,
  type TestDb,
  type AuthenticatedCaller,
} from "./setup.js";

describe("Members Integration", () => {
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

  /**
   * Helper to create test referrer and collector users.
   */
  async function createTestUsers() {
    const referrer = await caller.createUser({ name: "Test Referrer", phone: "+18091234567", role: "REFERRER" });
    const collector = await caller.createUser({ name: "Test Collector", phone: "+18091234568", role: "COLLECTOR" });
    return { referrer, collector };
  }

  describe("createMember", () => {
    it("should create a member with required fields", async () => {
      const { referrer, collector } = await createTestUsers();
      const input = {
        name: "John Doe",
        phone: "+18091234569",
        idNumber: "001-1234567-8",
        collectionPoint: "https://example.com/market-square",
        homeAddress: "123 Main St, City",
        referredById: referrer.id,
        assignedCollectorId: collector.id,
      };

      const member = await caller.createMember(input);

      expect(member.id).to.be.a("string");
      expect(member.name).to.equal(input.name);
      // Phone should be normalized (stripped +)
      expect(member.phone).to.equal("18091234569");
      expect(member.idNumber).to.equal(input.idNumber);
      expect(member.collectionPoint).to.equal(input.collectionPoint);
      expect(member.homeAddress).to.equal(input.homeAddress);
      expect(member.isActive).to.equal(true);
      expect(member.isBusinessOwner).to.equal(false);
      expect(member.referredById).to.equal(referrer.id);
      expect(member.assignedCollectorId).to.equal(collector.id);
    });

    it("should create a member with optional fields", async () => {
      const { referrer, collector } = await createTestUsers();
      const input = {
        name: "Jane Smith",
        phone: "+18091234570",
        idNumber: "002-2345678-9",
        collectionPoint: "https://example.com/downtown-plaza",
        homeAddress: "456 Oak Ave, Town",
        jobPosition: "Shop Owner",
        income: 5000,
        isBusinessOwner: true,
        referredById: referrer.id,
        assignedCollectorId: collector.id,
        note: "Test note",
      };

      const member = await caller.createMember(input);

      expect(member.jobPosition).to.equal(input.jobPosition);
      expect(Number(member.income)).to.equal(input.income);
      expect(member.isBusinessOwner).to.equal(true);
      expect(member.note).to.equal(input.note);
    });

    it("should create a member with referrer and collector", async () => {
      const { referrer, collector } = await createTestUsers();

      const input = {
        name: "Bob Johnson",
        phone: "+18091234571",
        idNumber: "003-3456789-0",
        collectionPoint: "https://example.com/central-market",
        homeAddress: "789 Pine Rd",
        referredById: referrer.id,
        assignedCollectorId: collector.id,
      };

      const member = await caller.createMember(input);

      expect(member.referredById).to.equal(referrer.id);
      expect(member.assignedCollectorId).to.equal(collector.id);
    });
  });

  describe("getMember", () => {
    it("should retrieve a member by ID", async () => {
      const { referrer, collector } = await createTestUsers();
      // Create a member first
      const created = await caller.createMember({
        name: "Test Member",
        phone: "+18091234572",
        idNumber: "004-4567890-1",
        collectionPoint: "https://example.com/test-point",
        homeAddress: "Test Address",
        referredById: referrer.id,
        assignedCollectorId: collector.id,
      });

      const fetched = await caller.getMember({ id: created.id });

      expect(fetched.id).to.equal(created.id);
      expect(fetched.name).to.equal(created.name);
      expect(fetched.phone).to.equal(created.phone);
    });

    it("should return null for non-existent member", async () => {
      const result = await caller.getMember({
        id: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(result).to.be.null;
    });
  });

  describe("updateMember", () => {
    it("should update member name", async () => {
      const { referrer, collector } = await createTestUsers();
      const created = await caller.createMember({
        name: "Original Name",
        phone: "+18091234573",
        idNumber: "005-5678901-2",
        collectionPoint: "https://example.com/update-point",
        homeAddress: "Update Address",
        referredById: referrer.id,
        assignedCollectorId: collector.id,
      });

      const updated = await caller.updateMember({
        id: created.id,
        name: "Updated Name",
      });

      expect(updated.name).to.equal("Updated Name");
      expect(updated.phone).to.equal(created.phone); // Unchanged
    });

    it("should update member phone", async () => {
      const { referrer, collector } = await createTestUsers();
      const created = await caller.createMember({
        name: "Phone Test",
        phone: "+18091234574",
        idNumber: "006-6789012-3",
        collectionPoint: "https://example.com/phone-point",
        homeAddress: "Phone Address",
        referredById: referrer.id,
        assignedCollectorId: collector.id,
      });

      const updated = await caller.updateMember({
        id: created.id,
        phone: "+18091234575",
      });

      // Phone should be normalized (stripped +)
      expect(updated.phone).to.equal("18091234575");
    });

    it("should update member note", async () => {
      const { referrer, collector } = await createTestUsers();
      const created = await caller.createMember({
        name: "Note Test",
        phone: "+18091234576",
        idNumber: "007-7890123-4",
        collectionPoint: "https://example.com/note-point",
        homeAddress: "Note Address",
        referredById: referrer.id,
        assignedCollectorId: collector.id,
      });

      const updated = await caller.updateMember({
        id: created.id,
        note: "Updated note",
      });

      expect(updated.note).to.equal("Updated note");
    });

    it("should deactivate a member", async () => {
      const { referrer, collector } = await createTestUsers();
      const created = await caller.createMember({
        name: "Active Member",
        phone: "+18091234577",
        idNumber: "008-8901234-5",
        collectionPoint: "https://example.com/active-point",
        homeAddress: "Active Address",
        referredById: referrer.id,
        assignedCollectorId: collector.id,
      });

      expect(created.isActive).to.equal(true);

      const updated = await caller.updateMember({
        id: created.id,
        isActive: false,
      });

      expect(updated.isActive).to.equal(false);
    });
  });

  describe("listMembers", () => {
    it("should list all members", async () => {
      const { referrer, collector } = await createTestUsers();
      // Create multiple members
      await caller.createMember({
        name: "Member 1",
        phone: "+18091234580",
        idNumber: "010-0123456-7",
        collectionPoint: "https://example.com/point-1",
        homeAddress: "Address 1",
        referredById: referrer.id,
        assignedCollectorId: collector.id,
      });
      await caller.createMember({
        name: "Member 2",
        phone: "+18091234581",
        idNumber: "011-1234567-8",
        collectionPoint: "https://example.com/point-2",
        homeAddress: "Address 2",
        referredById: referrer.id,
        assignedCollectorId: collector.id,
      });
      await caller.createMember({
        name: "Member 3",
        phone: "+18091234582",
        idNumber: "012-2345678-9",
        collectionPoint: "https://example.com/point-3",
        homeAddress: "Address 3",
        referredById: referrer.id,
        assignedCollectorId: collector.id,
      });

      const members = await caller.listMembers({});

      expect(members).to.be.an("array");
      expect(members).to.have.lengthOf(3);
    });

    it("should respect limit parameter", async () => {
      const { referrer, collector } = await createTestUsers();
      // Create 5 members
      for (let i = 1; i <= 5; i++) {
        await caller.createMember({
          name: `Member ${i}`,
          phone: `+1809123459${i}`,
          idNumber: `020-${String(i).padStart(7, "0")}-${i}`,
          collectionPoint: `https://example.com/point-${i}`,
          homeAddress: `Address ${i}`,
          referredById: referrer.id,
          assignedCollectorId: collector.id,
        });
      }

      const members = await caller.listMembers({ limit: 3 });

      expect(members).to.have.lengthOf(3);
    });

    it("should respect offset parameter", async () => {
      const { referrer, collector } = await createTestUsers();
      // Create 5 members
      for (let i = 1; i <= 5; i++) {
        await caller.createMember({
          name: `Member ${i}`,
          phone: `+1809123460${i}`,
          idNumber: `030-${String(i).padStart(7, "0")}-${i}`,
          collectionPoint: `https://example.com/point-${i}`,
          homeAddress: `Address ${i}`,
          referredById: referrer.id,
          assignedCollectorId: collector.id,
        });
      }

      const allMembers = await caller.listMembers({});
      const offsetMembers = await caller.listMembers({ offset: 2 });

      // Verify offset reduces the count by 2
      expect(allMembers).to.have.lengthOf(5);
      expect(offsetMembers).to.have.lengthOf(3);

      // Verify offset members are a subset of all members
      const allIds = new Set(allMembers.map((m) => m.id));
      offsetMembers.forEach((m) => {
        expect(allIds.has(m.id)).to.be.true;
      });
    });
  });

  describe("listMembersByReferrer", () => {
    it("should list members by referrer", async () => {
      // Create referrer
      const referrer = await caller.createUser({ name: "Test Referrer", phone: "+3333333333", role: "REFERRER" });
      const otherReferrer = await caller.createUser({ name: "Other Referrer", phone: "+4444444444", role: "REFERRER" });

      const { collector } = await createTestUsers();
      // Create members with different referrers
      await caller.createMember({
        name: "Referred Member 1",
        phone: "+18091234610",
        idNumber: "040-0123456-7",
        collectionPoint: "https://example.com/point",
        homeAddress: "Address",
        referredById: referrer.id,
        assignedCollectorId: collector.id,
      });
      await caller.createMember({
        name: "Referred Member 2",
        phone: "+18091234611",
        idNumber: "041-1234567-8",
        collectionPoint: "https://example.com/point",
        homeAddress: "Address",
        referredById: referrer.id,
        assignedCollectorId: collector.id,
      });
      await caller.createMember({
        name: "Other Referred",
        phone: "+18091234612",
        idNumber: "042-2345678-9",
        collectionPoint: "https://example.com/point",
        homeAddress: "Address",
        referredById: otherReferrer.id,
        assignedCollectorId: collector.id,
      });

      const members = await caller.listMembersByReferrer({
        referredById: referrer.id,
      });

      expect(members).to.have.lengthOf(2);
      members.forEach((m) => {
        expect(m.referredById).to.equal(referrer.id);
      });
    });

    it("should return empty array for referrer with no members", async () => {
      const referrer = await caller.createUser({ name: "Empty Referrer", phone: "+5555555555", role: "REFERRER" });

      const members = await caller.listMembersByReferrer({
        referredById: referrer.id,
      });

      expect(members).to.be.an("array");
      expect(members).to.have.lengthOf(0);
    });
  });

  describe("listMembersByCollector", () => {
    it("should list members by collector", async () => {
      // Create collector
      const collector = await caller.createUser({ name: "Test Collector", phone: "+6666666666", role: "COLLECTOR" });
      const otherCollector = await caller.createUser({ name: "Other Collector", phone: "+7777777777", role: "COLLECTOR" });

      const { referrer } = await createTestUsers();
      // Create members with different collectors
      await caller.createMember({
        name: "Assigned Member 1",
        phone: "+18091234620",
        idNumber: "050-0123456-7",
        collectionPoint: "https://example.com/point",
        homeAddress: "Address",
        referredById: referrer.id,
        assignedCollectorId: collector.id,
      });
      await caller.createMember({
        name: "Assigned Member 2",
        phone: "+18091234621",
        idNumber: "051-1234567-8",
        collectionPoint: "https://example.com/point",
        homeAddress: "Address",
        referredById: referrer.id,
        assignedCollectorId: collector.id,
      });
      await caller.createMember({
        name: "Other Assigned",
        phone: "+18091234622",
        idNumber: "052-2345678-9",
        collectionPoint: "https://example.com/point",
        homeAddress: "Address",
        referredById: referrer.id,
        assignedCollectorId: otherCollector.id,
      });

      const members = await caller.listMembersByCollector({
        assignedCollectorId: collector.id,
      });

      expect(members).to.have.lengthOf(2);
      members.forEach((m) => {
        expect(m.assignedCollectorId).to.equal(collector.id);
      });
    });

    it("should return empty array for collector with no assigned members", async () => {
      const collector = await caller.createUser({ name: "Empty Collector", phone: "+8888888888", role: "COLLECTOR" });

      const members = await caller.listMembersByCollector({
        assignedCollectorId: collector.id,
      });

      expect(members).to.be.an("array");
      expect(members).to.have.lengthOf(0);
    });
  });
});
