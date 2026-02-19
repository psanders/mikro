/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Integration tests for customer procedures.
 * Tests happy paths for all customer CRUD operations.
 */
import { expect } from "chai";
import {
  createTestDb,
  createAuthenticatedCaller,
  applySchema,
  type TestDb,
  type AuthenticatedCaller
} from "./setup.js";

describe("Customers Integration", () => {
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
    await db.customer.deleteMany();
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
    const referrer = await caller.createUser({
      name: "Test Referrer",
      phone: "+18091234567",
      role: "REFERRER"
    });
    const collector = await caller.createUser({
      name: "Test Collector",
      phone: "+18091234568",
      role: "COLLECTOR"
    });
    return { referrer, collector };
  }

  describe("createCustomer", () => {
    it("should create a customer with required fields", async () => {
      const { referrer, collector } = await createTestUsers();
      const input = {
        name: "John Doe",
        phone: "+18091234569",
        idNumber: "001-1234567-8",
        collectionPoint: "https://example.com/market-square",
        homeAddress: "123 Main St, City",
        referredById: referrer.id,
        assignedCollectorId: collector.id
      };

      const customer = await caller.createCustomer(input);

      expect(customer.id).to.be.a("string");
      expect(customer.name).to.equal(input.name);
      // Phone should be normalized to E.164 format
      expect(customer.phone).to.equal("+18091234569");
      expect(customer.idNumber).to.equal(input.idNumber);
      expect(customer.collectionPoint).to.equal(input.collectionPoint);
      expect(customer.homeAddress).to.equal(input.homeAddress);
      expect(customer.isActive).to.equal(false); // Default is false in database
      expect(customer.isBusinessOwner).to.equal(false);
      expect(customer.referredById).to.equal(referrer.id);
      expect(customer.assignedCollectorId).to.equal(collector.id);
    });

    it("should create a customer with optional fields", async () => {
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
        notes: "Test note"
      };

      const customer = await caller.createCustomer(input);

      expect(customer.jobPosition).to.equal(input.jobPosition);
      expect(Number(customer.income)).to.equal(input.income);
      expect(customer.isBusinessOwner).to.equal(true);
      expect(customer.notes).to.equal(input.notes);
    });

    it("should create a customer with referrer and collector", async () => {
      const { referrer, collector } = await createTestUsers();

      const input = {
        name: "Bob Johnson",
        phone: "+18091234571",
        idNumber: "003-3456789-0",
        collectionPoint: "https://example.com/central-market",
        homeAddress: "789 Pine Rd",
        referredById: referrer.id,
        assignedCollectorId: collector.id
      };

      const customer = await caller.createCustomer(input);

      expect(customer.referredById).to.equal(referrer.id);
      expect(customer.assignedCollectorId).to.equal(collector.id);
    });
  });

  describe("getCustomer", () => {
    it("should retrieve a customer by ID", async () => {
      const { referrer, collector } = await createTestUsers();
      // Create a customer first
      const created = await caller.createCustomer({
        name: "Test Customer",
        phone: "+18091234572",
        idNumber: "004-4567890-1",
        collectionPoint: "https://example.com/test-point",
        homeAddress: "Test Address",
        referredById: referrer.id,
        assignedCollectorId: collector.id
      });

      const fetched = await caller.getCustomer({ id: created.id });

      expect(fetched.id).to.equal(created.id);
      expect(fetched.name).to.equal(created.name);
      expect(fetched.phone).to.equal(created.phone);
    });

    it("should return null for non-existent customer", async () => {
      const result = await caller.getCustomer({
        id: "550e8400-e29b-41d4-a716-446655440000"
      });

      expect(result).to.be.null;
    });
  });

  describe("updateCustomer", () => {
    it("should update customer name", async () => {
      const { referrer, collector } = await createTestUsers();
      const created = await caller.createCustomer({
        name: "Original Name",
        phone: "+18091234573",
        idNumber: "005-5678901-2",
        collectionPoint: "https://example.com/update-point",
        homeAddress: "Update Address",
        referredById: referrer.id,
        assignedCollectorId: collector.id
      });

      const updated = await caller.updateCustomer({
        id: created.id,
        name: "Updated Name"
      });

      expect(updated.name).to.equal("Updated Name");
      expect(updated.phone).to.equal(created.phone); // Unchanged
    });

    it("should update customer phone", async () => {
      const { referrer, collector } = await createTestUsers();
      const created = await caller.createCustomer({
        name: "Phone Test",
        phone: "+18091234574",
        idNumber: "006-6789012-3",
        collectionPoint: "https://example.com/phone-point",
        homeAddress: "Phone Address",
        referredById: referrer.id,
        assignedCollectorId: collector.id
      });

      const updated = await caller.updateCustomer({
        id: created.id,
        phone: "+18091234575"
      });

      // Phone should be normalized to E.164 format
      expect(updated.phone).to.equal("+18091234575");
    });

    it("should update customer note", async () => {
      const { referrer, collector } = await createTestUsers();
      const created = await caller.createCustomer({
        name: "Note Test",
        phone: "+18091234576",
        idNumber: "007-7890123-4",
        collectionPoint: "https://example.com/note-point",
        homeAddress: "Note Address",
        referredById: referrer.id,
        assignedCollectorId: collector.id
      });

      const updated = await caller.updateCustomer({
        id: created.id,
        notes: "Updated note"
      });

      expect(updated.notes).to.equal("Updated note");
    });

    it("should deactivate a customer", async () => {
      const { referrer, collector } = await createTestUsers();
      const created = await caller.createCustomer({
        name: "Active Customer",
        phone: "+18091234577",
        idNumber: "008-8901234-5",
        collectionPoint: "https://example.com/active-point",
        homeAddress: "Active Address",
        referredById: referrer.id,
        assignedCollectorId: collector.id
      });

      expect(created.isActive).to.equal(false); // Default is false

      const updated = await caller.updateCustomer({
        id: created.id,
        isActive: true
      });

      expect(updated.isActive).to.equal(true);

      // Then deactivate
      const deactivated = await caller.updateCustomer({
        id: created.id,
        isActive: false
      });

      expect(deactivated.isActive).to.equal(false);
    });
  });

  describe("listCustomers", () => {
    it("should list all customers", async () => {
      const { referrer, collector } = await createTestUsers();
      // Create multiple customers
      await caller.createCustomer({
        name: "Customer 1",
        phone: "+18091234580",
        idNumber: "010-0123456-7",
        collectionPoint: "https://example.com/point-1",
        homeAddress: "Address 1",
        referredById: referrer.id,
        assignedCollectorId: collector.id
      });
      await caller.createCustomer({
        name: "Customer 2",
        phone: "+18091234581",
        idNumber: "011-1234567-8",
        collectionPoint: "https://example.com/point-2",
        homeAddress: "Address 2",
        referredById: referrer.id,
        assignedCollectorId: collector.id
      });
      await caller.createCustomer({
        name: "Customer 3",
        phone: "+18091234582",
        idNumber: "012-2345678-9",
        collectionPoint: "https://example.com/point-3",
        homeAddress: "Address 3",
        referredById: referrer.id,
        assignedCollectorId: collector.id
      });

      // listCustomers filters by isActive: true by default, but customers are created with isActive: false
      // So we need to use showInactive: true to see all customers
      const customers = await caller.listCustomers({ showInactive: true });

      expect(customers).to.be.an("array");
      expect(customers).to.have.lengthOf(3);
    });

    it("should respect limit parameter", async () => {
      const { referrer, collector } = await createTestUsers();
      // Create 5 customers
      for (let i = 1; i <= 5; i++) {
        await caller.createCustomer({
          name: `Customer ${i}`,
          phone: `+1809123459${i}`,
          idNumber: `020-${String(i).padStart(7, "0")}-${i}`,
          collectionPoint: `https://example.com/point-${i}`,
          homeAddress: `Address ${i}`,
          referredById: referrer.id,
          assignedCollectorId: collector.id
        });
      }

      // listCustomers filters by isActive: true by default
      const customers = await caller.listCustomers({ limit: 3, showInactive: true });

      expect(customers).to.have.lengthOf(3);
    });

    it("should respect offset parameter", async () => {
      const { referrer, collector } = await createTestUsers();
      // Create 5 customers
      for (let i = 1; i <= 5; i++) {
        await caller.createCustomer({
          name: `Customer ${i}`,
          phone: `+1809123460${i}`,
          idNumber: `030-${String(i).padStart(7, "0")}-${i}`,
          collectionPoint: `https://example.com/point-${i}`,
          homeAddress: `Address ${i}`,
          referredById: referrer.id,
          assignedCollectorId: collector.id
        });
      }

      // listCustomers filters by isActive: true by default
      const allCustomers = await caller.listCustomers({ showInactive: true });
      const offsetCustomers = await caller.listCustomers({ offset: 2, showInactive: true });

      // Verify offset reduces the count by 2
      expect(allCustomers).to.have.lengthOf(5);
      expect(offsetCustomers).to.have.lengthOf(3);

      // Verify offset customers are a subset of all customers
      const allIds = new Set(allCustomers.map((c) => c.id));
      offsetCustomers.forEach((c) => {
        expect(allIds.has(c.id)).to.be.true;
      });
    });
  });

  describe("listCustomersByReferrer", () => {
    it("should list customers by referrer", async () => {
      // Create referrer
      const referrer = await caller.createUser({
        name: "Test Referrer",
        phone: "+18091234630",
        role: "REFERRER"
      });
      const otherReferrer = await caller.createUser({
        name: "Other Referrer",
        phone: "+18091234631",
        role: "REFERRER"
      });

      const { collector } = await createTestUsers();
      // Create customers with different referrers
      await caller.createCustomer({
        name: "Referred Customer 1",
        phone: "+18091234610",
        idNumber: "040-0123456-7",
        collectionPoint: "https://example.com/point",
        homeAddress: "Address",
        referredById: referrer.id,
        assignedCollectorId: collector.id
      });
      await caller.createCustomer({
        name: "Referred Customer 2",
        phone: "+18091234611",
        idNumber: "041-1234567-8",
        collectionPoint: "https://example.com/point",
        homeAddress: "Address",
        referredById: referrer.id,
        assignedCollectorId: collector.id
      });
      await caller.createCustomer({
        name: "Other Referred",
        phone: "+18091234612",
        idNumber: "042-2345678-9",
        collectionPoint: "https://example.com/point",
        homeAddress: "Address",
        referredById: otherReferrer.id,
        assignedCollectorId: collector.id
      });

      // listCustomersByReferrer filters by isActive: true by default
      const customers = await caller.listCustomersByReferrer({
        referredById: referrer.id,
        showInactive: true
      });

      expect(customers).to.have.lengthOf(2);
      customers.forEach((m) => {
        expect(m.referredById).to.equal(referrer.id);
      });
    });

    it("should return empty array for referrer with no customers", async () => {
      const referrer = await caller.createUser({
        name: "Empty Referrer",
        phone: "+18091234632",
        role: "REFERRER"
      });

      const customers = await caller.listCustomersByReferrer({
        referredById: referrer.id
      });

      expect(customers).to.be.an("array");
      expect(customers).to.have.lengthOf(0);
    });
  });

  describe("listCustomersByCollector", () => {
    it("should list customers by collector", async () => {
      // Create collector
      const collector = await caller.createUser({
        name: "Test Collector",
        phone: "+18091234633",
        role: "COLLECTOR"
      });
      const otherCollector = await caller.createUser({
        name: "Other Collector",
        phone: "+18091234634",
        role: "COLLECTOR"
      });

      const { referrer } = await createTestUsers();
      // Create customers with different collectors
      await caller.createCustomer({
        name: "Assigned Customer 1",
        phone: "+18091234620",
        idNumber: "050-0123456-7",
        collectionPoint: "https://example.com/point",
        homeAddress: "Address",
        referredById: referrer.id,
        assignedCollectorId: collector.id
      });
      await caller.createCustomer({
        name: "Assigned Customer 2",
        phone: "+18091234621",
        idNumber: "051-1234567-8",
        collectionPoint: "https://example.com/point",
        homeAddress: "Address",
        referredById: referrer.id,
        assignedCollectorId: collector.id
      });
      await caller.createCustomer({
        name: "Other Assigned",
        phone: "+18091234622",
        idNumber: "052-2345678-9",
        collectionPoint: "https://example.com/point",
        homeAddress: "Address",
        referredById: referrer.id,
        assignedCollectorId: otherCollector.id
      });

      // listCustomersByCollector filters by isActive: true by default
      const customers = await caller.listCustomersByCollector({
        assignedCollectorId: collector.id,
        showInactive: true
      });

      expect(customers).to.have.lengthOf(2);
      customers.forEach((m) => {
        expect(m.assignedCollectorId).to.equal(collector.id);
      });
    });

    it("should return empty array for collector with no assigned customers", async () => {
      const collector = await caller.createUser({
        name: "Empty Collector",
        phone: "+18091234635",
        role: "COLLECTOR"
      });

      const customers = await caller.listCustomersByCollector({
        assignedCollectorId: collector.id
      });

      expect(customers).to.be.an("array");
      expect(customers).to.have.lengthOf(0);
    });
  });
});
