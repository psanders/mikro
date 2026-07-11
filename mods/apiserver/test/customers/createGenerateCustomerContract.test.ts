/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The ad-hoc customer contract generator: renders a PDF from the customer row +
 * supplied terms, persists it as a CustomerDocument, rejects an unknown
 * customer and a customer missing identity, and never touches the database or
 * the renderer when the input is invalid.
 */
import { createHash } from "crypto";
import { expect } from "chai";
import sinon from "sinon";
import { createGenerateCustomerContract } from "../../src/api/customers/createGenerateCustomerContract.js";
import { ValidationError } from "@mikro/common";

const validInput = {
  customerId: "aacd7997-8ebc-4875-8d70-6b1db5ef7bf1",
  principal: 8256,
  installments: 10,
  installmentAmount: 1100,
  frequency: "WEEKLY" as const,
  startDate: "2026-07-20T12:00:00.000Z"
};

const customerRow = {
  id: validInput.customerId,
  name: "Enersida Brito Estrella",
  idNumber: "071-0047001-7",
  homeAddress: "San marco monterico",
  jobPosition: "Comerciante"
};

describe("createGenerateCustomerContract", () => {
  afterEach(() => sinon.restore());

  it("renders a contract PDF for an existing customer and persists it as a customer document", async () => {
    const createDocument = sinon.stub().resolves({});
    const client = {
      customer: { findUnique: sinon.stub().resolves(customerRow) },
      customerDocument: { create: createDocument }
    };
    const generate = createGenerateCustomerContract(client as any);

    const result = await generate(validInput);

    expect(result.mimeType).to.equal("application/pdf");
    expect(result.filename).to.equal(`contrato-${validInput.customerId.slice(0, 8)}.pdf`);
    // A real, non-empty PDF was produced (starts with the %PDF magic bytes).
    const pdf = Buffer.from(result.dataBase64, "base64");
    expect(pdf.length).to.be.greaterThan(0);
    expect(pdf.subarray(0, 5).toString("latin1")).to.equal("%PDF-");
    expect(client.customer.findUnique.calledOnceWith({ where: { id: validInput.customerId } })).to
      .be.true;

    // The persisted CustomerDocument's sha256 matches the returned PDF bytes.
    expect(createDocument.calledOnce).to.be.true;
    const docData = createDocument.getCall(0).args[0].data;
    expect(docData.type).to.equal("CONTRACT");
    expect(docData.source).to.equal("DIRECT");
    expect(docData.customerId).to.equal(validInput.customerId);
    const expectedSha256 = createHash("sha256").update(pdf).digest("hex");
    expect(docData.sha256).to.equal(expectedSha256);
    expect(docData.filename).to.equal(`${expectedSha256}.pdf`);
  });

  it("rejects an unknown customer without rendering or persisting", async () => {
    const createDocument = sinon.stub();
    const client = {
      customer: { findUnique: sinon.stub().resolves(null) },
      customerDocument: { create: createDocument }
    };
    const generate = createGenerateCustomerContract(client as any);

    try {
      await generate(validInput);
      expect.fail("expected NOT_FOUND");
    } catch (error) {
      expect((error as { code?: string }).code).to.equal("NOT_FOUND");
      expect(createDocument.called).to.be.false;
    }
  });

  it("rejects a customer missing name or cédula without persisting", async () => {
    const createDocument = sinon.stub();
    const client = {
      customer: { findUnique: sinon.stub().resolves({ ...customerRow, idNumber: "" }) },
      customerDocument: { create: createDocument }
    };
    const generate = createGenerateCustomerContract(client as any);

    try {
      await generate(validInput);
      expect.fail("expected BAD_REQUEST");
    } catch (error) {
      expect((error as { code?: string }).code).to.equal("BAD_REQUEST");
      expect(createDocument.called).to.be.false;
    }
  });

  it("throws a ValidationError and never queries the DB on invalid terms", async () => {
    const findUnique = sinon.stub();
    const client = { customer: { findUnique } };
    const generate = createGenerateCustomerContract(client as any);

    try {
      await generate({ ...validInput, principal: -5 });
      expect.fail("expected ValidationError");
    } catch (error) {
      expect(error).to.be.instanceOf(ValidationError);
      // No side effect: the customer was never looked up, so nothing rendered.
      expect(findUnique.called).to.be.false;
    }
  });

  it("rejects a malformed customer id before any lookup", async () => {
    const findUnique = sinon.stub();
    const client = { customer: { findUnique } };
    const generate = createGenerateCustomerContract(client as any);

    try {
      await generate({ ...validInput, customerId: "not-a-uuid" });
      expect.fail("expected ValidationError");
    } catch (error) {
      expect(error).to.be.instanceOf(ValidationError);
      expect(findUnique.called).to.be.false;
    }
  });
});
