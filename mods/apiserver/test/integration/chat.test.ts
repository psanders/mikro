/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Integration tests for chat procedures.
 * Tests happy paths for chat history retrieval.
 */
import { expect } from "chai";
import {
  createTestDb,
  createAuthenticatedCaller,
  applySchema,
  type TestDb,
  type AuthenticatedCaller
} from "./setup.js";

describe("Chat Integration", () => {
  let db: TestDb;
  let caller: AuthenticatedCaller;
  let chatPhoneSeq = 0;
  const chatNanp = () => {
    chatPhoneSeq += 1;
    return `+1809${String(10_000_000 + chatPhoneSeq).slice(1)}`;
  };

  before(async () => {
    db = createTestDb();
    await applySchema(db);
  });

  beforeEach(async () => {
    // Clean tables between tests (order matters due to foreign keys)
    await db.loanNote.deleteMany();
    await db.attachment.deleteMany();
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
   * Helper to create a test customer.
   */
  async function createTestCustomer(name = "Chat Test Customer") {
    const collector = await caller.createUser({
      name: "Test Collector",
      phone: chatNanp(),
      role: "COLLECTOR"
    });
    return caller.createCustomer({
      name,
      phone: chatNanp(),
      idNumber: `001-${String(Date.now()).slice(-7)}-8`,
      collectionPoint: "https://example.com/test-point",
      homeAddress: "Test Address",
      assignedCollectorId: collector.id
    });
  }

  /**
   * Helper to create a test user.
   */
  async function createTestUser(name = "Chat Test User") {
    return caller.createUser({
      name,
      phone: `+${Date.now()}`,
      role: "ADMIN"
    });
  }

  /**
   * Helper to create a message directly in the database.
   * Since there's no addMessage tRPC procedure, we use Prisma directly.
   */
  async function createMessage(options: {
    customerId?: string;
    userId?: string;
    role: "AI" | "HUMAN";
    content: string;
    tools?: string[];
    createdAt?: Date;
  }) {
    return db.message.create({
      data: {
        customerId: options.customerId,
        userId: options.userId,
        role: options.role,
        content: options.content,
        tools: options.tools ? JSON.stringify(options.tools) : null,
        createdAt: options.createdAt
      }
    });
  }

  /**
   * Helper to create an attachment for a message.
   */
  async function createAttachment(options: {
    messageId: string;
    type: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
    url: string;
    name?: string;
    mimeType?: string;
    size?: number;
  }) {
    return db.attachment.create({
      data: options
    });
  }

  describe("getChatHistory", () => {
    describe("for customers", () => {
      it("should retrieve chat history for a customer", async () => {
        const customer = await createTestCustomer();

        // Create messages
        await createMessage({
          customerId: customer.id,
          role: "HUMAN",
          content: "Hello, I need help with my loan."
        });
        await createMessage({
          customerId: customer.id,
          role: "AI",
          content: "Hi! I can help you with that. What would you like to know?"
        });

        const history = await caller.getChatHistory({ customerId: customer.id });

        expect(history).to.be.an("array");
        expect(history).to.have.lengthOf(2);
        expect(history[0].role).to.equal("HUMAN");
        expect(history[1].role).to.equal("AI");
      });

      it("should return messages in ascending order by createdAt", async () => {
        const customer = await createTestCustomer();

        // Create messages with specific timestamps
        await createMessage({
          customerId: customer.id,
          role: "HUMAN",
          content: "First message",
          createdAt: new Date("2026-01-15T10:00:00Z")
        });
        await createMessage({
          customerId: customer.id,
          role: "AI",
          content: "Second message",
          createdAt: new Date("2026-01-15T10:01:00Z")
        });
        await createMessage({
          customerId: customer.id,
          role: "HUMAN",
          content: "Third message",
          createdAt: new Date("2026-01-15T10:02:00Z")
        });

        const history = await caller.getChatHistory({ customerId: customer.id });

        expect(history[0].content).to.equal("First message");
        expect(history[1].content).to.equal("Second message");
        expect(history[2].content).to.equal("Third message");
      });

      it("should include attachments with messages", async () => {
        const customer = await createTestCustomer();

        const message = await createMessage({
          customerId: customer.id,
          role: "HUMAN",
          content: "Here is my ID photo"
        });

        await createAttachment({
          messageId: message.id,
          type: "IMAGE",
          url: "https://example.com/id-photo.jpg",
          name: "id-photo.jpg",
          mimeType: "image/jpeg",
          size: 102400
        });

        const history = await caller.getChatHistory({ customerId: customer.id });

        expect(history).to.have.lengthOf(1);
        expect(history[0].attachments).to.be.an("array");
        expect(history[0].attachments).to.have.lengthOf(1);
        expect(history[0].attachments[0].type).to.equal("IMAGE");
        expect(history[0].attachments[0].url).to.equal("https://example.com/id-photo.jpg");
      });

      it("should include tools for AI messages", async () => {
        const customer = await createTestCustomer();

        await createMessage({
          customerId: customer.id,
          role: "AI",
          content: "I checked your loan status. Here are the details...",
          tools: ["check_loan_status", "get_customer_info"]
        });

        const history = await caller.getChatHistory({ customerId: customer.id });

        expect(history).to.have.lengthOf(1);
        expect(history[0].tools).to.equal(
          JSON.stringify(["check_loan_status", "get_customer_info"])
        );
      });

      it("should respect limit parameter", async () => {
        const customer = await createTestCustomer();

        // Create 5 messages
        for (let i = 1; i <= 5; i++) {
          await createMessage({
            customerId: customer.id,
            role: i % 2 === 0 ? "AI" : "HUMAN",
            content: `Message ${i}`,
            createdAt: new Date(`2026-01-15T10:0${i}:00Z`)
          });
        }

        const history = await caller.getChatHistory({
          customerId: customer.id,
          limit: 3
        });

        expect(history).to.have.lengthOf(3);
      });

      it("should respect offset parameter", async () => {
        const customer = await createTestCustomer();

        // Create 5 messages
        for (let i = 1; i <= 5; i++) {
          await createMessage({
            customerId: customer.id,
            role: "HUMAN",
            content: `Message ${i}`,
            createdAt: new Date(`2026-01-15T10:0${i}:00Z`)
          });
        }

        const history = await caller.getChatHistory({
          customerId: customer.id,
          offset: 2
        });

        expect(history).to.have.lengthOf(3);
        expect(history[0].content).to.equal("Message 3");
      });

      it("should return empty array for customer with no messages", async () => {
        const customer = await createTestCustomer();

        const history = await caller.getChatHistory({ customerId: customer.id });

        expect(history).to.be.an("array");
        expect(history).to.have.lengthOf(0);
      });

      it("should only return messages for specified customer", async () => {
        const customer1 = await createTestCustomer("Customer 1");
        const customer2 = await createTestCustomer("Customer 2");

        await createMessage({
          customerId: customer1.id,
          role: "HUMAN",
          content: "Message from customer 1"
        });
        await createMessage({
          customerId: customer2.id,
          role: "HUMAN",
          content: "Message from customer 2"
        });

        const history = await caller.getChatHistory({ customerId: customer1.id });

        expect(history).to.have.lengthOf(1);
        expect(history[0].content).to.equal("Message from customer 1");
      });
    });

    describe("for users", () => {
      it("should retrieve chat history for a user", async () => {
        const user = await createTestUser();

        await createMessage({
          userId: user.id,
          role: "HUMAN",
          content: "User question"
        });
        await createMessage({
          userId: user.id,
          role: "AI",
          content: "AI response to user"
        });

        const history = await caller.getChatHistory({ userId: user.id });

        expect(history).to.be.an("array");
        expect(history).to.have.lengthOf(2);
      });

      it("should return empty array for user with no messages", async () => {
        const user = await createTestUser();

        const history = await caller.getChatHistory({ userId: user.id });

        expect(history).to.be.an("array");
        expect(history).to.have.lengthOf(0);
      });

      it("should only return messages for specified user", async () => {
        const user1 = await createTestUser("User 1");
        const user2 = await createTestUser("User 2");

        await createMessage({
          userId: user1.id,
          role: "HUMAN",
          content: "Message from user 1"
        });
        await createMessage({
          userId: user2.id,
          role: "HUMAN",
          content: "Message from user 2"
        });

        const history = await caller.getChatHistory({ userId: user1.id });

        expect(history).to.have.lengthOf(1);
        expect(history[0].content).to.equal("Message from user 1");
      });
    });
  });
});
