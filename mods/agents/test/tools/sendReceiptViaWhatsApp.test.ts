/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Unit tests for the sendReceiptViaWhatsApp executor handler. Covers the
 * original Juan/collector path (recipient inferred from context.phone) and
 * the founder-copilot path added for mikro/#118, where the model supplies an
 * explicit `phone` argument (the copilot has no live WhatsApp conversation of
 * its own to infer a recipient from).
 */
import { expect } from "chai";
import sinon from "sinon";
import { handleSendReceiptViaWhatsApp } from "../../src/tools/executor/sendReceiptViaWhatsApp.js";
import type { ToolExecutorDependencies } from "../../src/tools/executor/types.js";

const VALID_PAYMENT_ID = "11111111-1111-4111-8111-111111111111";

function makeDeps(stub: sinon.SinonStub): ToolExecutorDependencies {
  return { sendReceiptViaWhatsApp: stub } as unknown as ToolExecutorDependencies;
}

describe("handleSendReceiptViaWhatsApp", () => {
  afterEach(() => sinon.restore());

  it("rejects an invalid paymentId without calling the dependency", async () => {
    const stub = sinon.stub();
    const result = await handleSendReceiptViaWhatsApp(makeDeps(stub), { paymentId: "not-a-uuid" });

    expect(result.success).to.be.false;
    expect(result.message).to.match(/inválido/);
    expect(stub.called).to.be.false;
  });

  it("Juan/collector flow: uses context.phone when no explicit phone is given", async () => {
    const stub = sinon.stub().resolves({ success: true, messageId: "wamid.1" });
    const result = await handleSendReceiptViaWhatsApp(
      makeDeps(stub),
      { paymentId: VALID_PAYMENT_ID },
      { phone: "+18095551111" }
    );

    expect(result.success).to.be.true;
    expect(stub.calledOnceWith({ paymentId: VALID_PAYMENT_ID, phone: "+18095551111" })).to.be.true;
  });

  it("copilot flow (#118): an explicit phone arg is used even without context.phone", async () => {
    const stub = sinon.stub().resolves({ success: true, messageId: "wamid.2" });
    const result = await handleSendReceiptViaWhatsApp(makeDeps(stub), {
      paymentId: VALID_PAYMENT_ID,
      phone: "+18095552222"
    });

    expect(result.success).to.be.true;
    expect(stub.calledOnceWith({ paymentId: VALID_PAYMENT_ID, phone: "+18095552222" })).to.be.true;
  });

  it("prefers an explicit phone arg over context.phone when both are present", async () => {
    const stub = sinon.stub().resolves({ success: true, messageId: "wamid.3" });
    await handleSendReceiptViaWhatsApp(
      makeDeps(stub),
      { paymentId: VALID_PAYMENT_ID, phone: "+18095553333" },
      { phone: "+18095554444" }
    );

    expect(stub.calledOnceWith({ paymentId: VALID_PAYMENT_ID, phone: "+18095553333" })).to.be.true;
  });

  it("refuses without calling the dependency when neither phone nor context.phone is present", async () => {
    const stub = sinon.stub();
    const result = await handleSendReceiptViaWhatsApp(makeDeps(stub), {
      paymentId: VALID_PAYMENT_ID
    });

    expect(result.success).to.be.false;
    expect(result.message).to.match(/teléfono/);
    expect(stub.called).to.be.false;
  });

  it("surfaces a failed send as success: false with the underlying error", async () => {
    const stub = sinon.stub().resolves({ success: false, error: "número inválido" });
    const result = await handleSendReceiptViaWhatsApp(makeDeps(stub), {
      paymentId: VALID_PAYMENT_ID,
      phone: "+18095555555"
    });

    expect(result.success).to.be.false;
    expect(result.message).to.match(/número inválido/);
  });
});
