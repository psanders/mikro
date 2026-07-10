/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createListCustomerDocuments } from "../../src/api/customers/createListCustomerDocuments.js";
import { ValidationError } from "@mikro/common";

describe("createListCustomerDocuments", () => {
  const validCustomerId = "550e8400-e29b-41d4-a716-446655440000";

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("returns all documents for a customer, most-recent-first", async () => {
      const now = new Date();
      const mockDocs = [
        {
          id: "doc-2",
          type: "CONTRACT",
          filename: "bbb.pdf",
          sha256: "bbb",
          source: "DIRECT",
          customerId: validCustomerId,
          createdAt: now
        },
        {
          id: "doc-1",
          type: "ID_FRONT",
          filename: "aaa.jpg",
          sha256: "aaa",
          source: "MIGRATED_FROM_APPLICATION",
          customerId: validCustomerId,
          createdAt: new Date(now.getTime() - 86_400_000)
        }
      ];
      const mockClient = {
        customerDocument: { findMany: sinon.stub().resolves(mockDocs) }
      };
      const listDocs = createListCustomerDocuments(mockClient as any);

      const result = await listDocs({ customerId: validCustomerId });

      expect(result).to.have.lengthOf(2);
      expect(result[0].id).to.equal("doc-2");
      expect(mockClient.customerDocument.findMany.calledOnce).to.be.true;
      const call = mockClient.customerDocument.findMany.getCall(0);
      expect(call.args[0].where.customerId).to.equal(validCustomerId);
      expect(call.args[0].orderBy.createdAt).to.equal("desc");
    });

    it("returns an empty array for a customer with no documents", async () => {
      const mockClient = {
        customerDocument: { findMany: sinon.stub().resolves([]) }
      };
      const listDocs = createListCustomerDocuments(mockClient as any);

      const result = await listDocs({ customerId: validCustomerId });

      expect(result).to.be.an("array").with.lengthOf(0);
    });
  });

  describe("with invalid input", () => {
    it("throws ValidationError for a malformed customerId", async () => {
      const mockClient = {
        customerDocument: { findMany: sinon.stub() }
      };
      const listDocs = createListCustomerDocuments(mockClient as any);

      try {
        await listDocs({ customerId: "not-a-uuid" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.customerDocument.findMany.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("propagates the error", async () => {
      const mockClient = {
        customerDocument: { findMany: sinon.stub().rejects(new Error("Connection failed")) }
      };
      const listDocs = createListCustomerDocuments(mockClient as any);

      try {
        await listDocs({ customerId: validCustomerId });
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Connection failed");
      }
    });
  });
});
