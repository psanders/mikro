/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The ad-hoc customer contract generator: renders a PDF from the customer row +
 * supplied terms, rejects an unknown customer and a customer missing identity,
 * and never touches the database or the renderer when the input is invalid.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createGenerateCustomerContract } from "../../src/api/customers/createGenerateCustomerContract.js";
import { ValidationError } from "@mikro/common";

const validInput = {
  customerId: "aacd7997-8ebc-4875-8d70-6b1db5ef7bf1",
  gender: "F" as const,
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

  it("renders a contract PDF for an existing customer", async () => {
    const client = { customer: { findUnique: sinon.stub().resolves(customerRow) } };
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
  });

  it("rejects an unknown customer without rendering", async () => {
    const client = { customer: { findUnique: sinon.stub().resolves(null) } };
    const generate = createGenerateCustomerContract(client as any);

    try {
      await generate(validInput);
      expect.fail("expected NOT_FOUND");
    } catch (error) {
      expect((error as { code?: string }).code).to.equal("NOT_FOUND");
    }
  });

  it("rejects a customer missing name or cédula", async () => {
    const client = {
      customer: { findUnique: sinon.stub().resolves({ ...customerRow, idNumber: "" }) }
    };
    const generate = createGenerateCustomerContract(client as any);

    try {
      await generate(validInput);
      expect.fail("expected BAD_REQUEST");
    } catch (error) {
      expect((error as { code?: string }).code).to.equal("BAD_REQUEST");
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
      // No side effect: the customer was never looked up, so nothing rendered
      // and no contract.generated event can be produced for this call.
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
