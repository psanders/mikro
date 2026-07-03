/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { handleSendPromo } from "../../src/tools/executor/sendPromo.js";
import type { ToolExecutorDependencies } from "../../src/tools/executor/types.js";

function makeDeps(stub: sinon.SinonStub): ToolExecutorDependencies {
  return { sendPromo: stub } as unknown as ToolExecutorDependencies;
}

describe("handleSendPromo", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("sends the promo and reports success with the message id", async () => {
    const sendPromoStub = sinon.stub().resolves({ sent: true, messageId: "wamid.123" });
    const deps = makeDeps(sendPromoStub);

    const result = await handleSendPromo(deps, { phone: "+18095551234" });

    expect(result.success).to.be.true;
    expect(result.message).to.match(/wamid\.123/);
    expect(sendPromoStub.calledOnceWith({ phone: "+18095551234" })).to.be.true;
  });

  it("refuses without calling sendPromo when phone is missing", async () => {
    const sendPromoStub = sinon.stub();
    const deps = makeDeps(sendPromoStub);

    const result = await handleSendPromo(deps, {});

    expect(result.success).to.be.false;
    expect(result.message).to.match(/teléfono/);
    expect(sendPromoStub.called).to.be.false;
  });

  it("surfaces a failed send as success: false with the underlying error", async () => {
    const sendPromoStub = sinon.stub().resolves({ sent: false, error: "número inválido" });
    const deps = makeDeps(sendPromoStub);

    const result = await handleSendPromo(deps, { phone: "123" });

    expect(result.success).to.be.false;
    expect(result.message).to.match(/número inválido/);
  });
});
