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

  describe("createMember", () => {
    it("should create a member with required fields", async () => {
      const input = {
        name: "John Doe",
        phone: "+1234567890",
        idNumber: "ID-12345",
        collectionPoint: "Market Square",
        homeAddress: "123 Main St, City",
      };

      const member = await caller.createMember(input);

      expect(member.id).to.be.a("string");
      expect(member.name).to.equal(input.name);
      expect(member.phone).to.equal(input.phone);
      expect(member.idNumber).to.equal(input.idNumber);
      expect(member.collectionPoint).to.equal(input.collectionPoint);
      expect(member.homeAddress).to.equal(input.homeAddress);
      expect(member.isActive).to.equal(true);
      expect(member.isBusinessOwner).to.equal(false);
    });

    it("should create a member with optional fields", async () => {
      const input = {
        name: "Jane Smith",
        phone: "+0987654321",
        idNumber: "ID-67890",
        collectionPoint: "Downtown Plaza",
        homeAddress: "456 Oak Ave, Town",
        jobPosition: "Shop Owner",
        income: 5000,
        isBusinessOwner: true,
      };

      const member = await caller.createMember(input);

      expect(member.jobPosition).to.equal(input.jobPosition);
      expect(Number(member.income)).to.equal(input.income);
      expect(member.isBusinessOwner).to.equal(true);
    });

    it("should create a member with referrer and collector", async () => {
      // Create users first
      const referrer = await caller.createUser({ name: "Referrer", phone: "+1111111111", role: "REFERRER" });
      const collector = await caller.createUser({ name: "Collector", phone: "+2222222222", role: "COLLECTOR" });

      const input = {
        name: "Bob Johnson",
        phone: "+1122334455",
        idNumber: "ID-11111",
        collectionPoint: "Central Market",
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
      // Create a member first
      const created = await caller.createMember({
        name: "Test Member",
        phone: "+1111111111",
        idNumber: "ID-TEST",
        collectionPoint: "Test Point",
        homeAddress: "Test Address",
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
      const created = await caller.createMember({
        name: "Original Name",
        phone: "+2222222222",
        idNumber: "ID-UPDATE",
        collectionPoint: "Update Point",
        homeAddress: "Update Address",
      });

      const updated = await caller.updateMember({
        id: created.id,
        name: "Updated Name",
      });

      expect(updated.name).to.equal("Updated Name");
      expect(updated.phone).to.equal(created.phone); // Unchanged
    });

    it("should update member phone", async () => {
      const created = await caller.createMember({
        name: "Phone Test",
        phone: "+3333333333",
        idNumber: "ID-PHONE",
        collectionPoint: "Phone Point",
        homeAddress: "Phone Address",
      });

      const updated = await caller.updateMember({
        id: created.id,
        phone: "+9999999999",
      });

      expect(updated.phone).to.equal("+9999999999");
    });

    it("should deactivate a member", async () => {
      const created = await caller.createMember({
        name: "Active Member",
        phone: "+4444444444",
        idNumber: "ID-ACTIVE",
        collectionPoint: "Active Point",
        homeAddress: "Active Address",
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
      // Create multiple members
      await caller.createMember({
        name: "Member 1",
        phone: "+1000000001",
        idNumber: "ID-001",
        collectionPoint: "Point 1",
        homeAddress: "Address 1",
      });
      await caller.createMember({
        name: "Member 2",
        phone: "+1000000002",
        idNumber: "ID-002",
        collectionPoint: "Point 2",
        homeAddress: "Address 2",
      });
      await caller.createMember({
        name: "Member 3",
        phone: "+1000000003",
        idNumber: "ID-003",
        collectionPoint: "Point 3",
        homeAddress: "Address 3",
      });

      const members = await caller.listMembers({});

      expect(members).to.be.an("array");
      expect(members).to.have.lengthOf(3);
    });

    it("should respect limit parameter", async () => {
      // Create 5 members
      for (let i = 1; i <= 5; i++) {
        await caller.createMember({
          name: `Member ${i}`,
          phone: `+200000000${i}`,
          idNumber: `ID-LIMIT-${i}`,
          collectionPoint: `Point ${i}`,
          homeAddress: `Address ${i}`,
        });
      }

      const members = await caller.listMembers({ limit: 3 });

      expect(members).to.have.lengthOf(3);
    });

    it("should respect offset parameter", async () => {
      // Create 5 members
      for (let i = 1; i <= 5; i++) {
        await caller.createMember({
          name: `Member ${i}`,
          phone: `+300000000${i}`,
          idNumber: `ID-OFFSET-${i}`,
          collectionPoint: `Point ${i}`,
          homeAddress: `Address ${i}`,
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

      // Create members with different referrers
      await caller.createMember({
        name: "Referred Member 1",
        phone: "+4000000001",
        idNumber: "ID-REF-1",
        collectionPoint: "Point",
        homeAddress: "Address",
        referredById: referrer.id,
      });
      await caller.createMember({
        name: "Referred Member 2",
        phone: "+4000000002",
        idNumber: "ID-REF-2",
        collectionPoint: "Point",
        homeAddress: "Address",
        referredById: referrer.id,
      });
      await caller.createMember({
        name: "Other Referred",
        phone: "+4000000003",
        idNumber: "ID-REF-3",
        collectionPoint: "Point",
        homeAddress: "Address",
        referredById: otherReferrer.id,
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

      // Create members with different collectors
      await caller.createMember({
        name: "Assigned Member 1",
        phone: "+5000000001",
        idNumber: "ID-COL-1",
        collectionPoint: "Point",
        homeAddress: "Address",
        assignedCollectorId: collector.id,
      });
      await caller.createMember({
        name: "Assigned Member 2",
        phone: "+5000000002",
        idNumber: "ID-COL-2",
        collectionPoint: "Point",
        homeAddress: "Address",
        assignedCollectorId: collector.id,
      });
      await caller.createMember({
        name: "Other Assigned",
        phone: "+5000000003",
        idNumber: "ID-COL-3",
        collectionPoint: "Point",
        homeAddress: "Address",
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
