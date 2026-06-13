/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createSendApplicationPromo } from "../../src/api/applications/createSendApplicationPromo.js";

const IMG = "https://example.com/promo.jpg";

describe("createSendApplicationPromo", () => {
  afterEach(() => sinon.restore());

  it("sends the configured template once with header image + flow token", async () => {
    const sendTemplateMessage = sinon.stub().resolves({ messages: [{ id: "wamid.123" }] });
    const send = createSendApplicationPromo({
      sendTemplateMessage,
      templateName: "loan_application",
      languageCode: "en",
      imageUrl: IMG
    });

    const result = await send({ phone: "+18298717987", flowToken: "app-1" });

    expect(result).to.deep.equal({ sent: true, messageId: "wamid.123" });
    expect(sendTemplateMessage.calledOnce).to.be.true;
    const arg = sendTemplateMessage.firstCall.args[0];
    expect(arg.phone).to.equal("+18298717987");
    expect(arg.templateName).to.equal("loan_application");
    expect(arg.languageCode).to.equal("en");
    expect(arg.headerImageUrl).to.equal(IMG);
    expect(arg.flowToken).to.equal("app-1");
  });

  it("does not send and reports not-sent when phone is null", async () => {
    const sendTemplateMessage = sinon.stub();
    const send = createSendApplicationPromo({
      sendTemplateMessage,
      templateName: "loan_application",
      languageCode: "en",
      imageUrl: IMG
    });

    const result = await send({ phone: null, flowToken: "app-1" });

    expect(result.sent).to.be.false;
    expect(result.error).to.be.a("string");
    expect(sendTemplateMessage.called).to.be.false;
  });

  it("does not send when the promo image URL is not configured", async () => {
    const sendTemplateMessage = sinon.stub();
    const send = createSendApplicationPromo({
      sendTemplateMessage,
      templateName: "loan_application",
      languageCode: "en",
      imageUrl: ""
    });

    const result = await send({ phone: "+18298717987", flowToken: "app-1" });

    expect(result.sent).to.be.false;
    expect(result.error).to.contain("loanApplicationPromoImageUrl");
    expect(sendTemplateMessage.called).to.be.false;
  });

  it("returns a promo error (does not throw) when the WhatsApp send fails", async () => {
    const sendTemplateMessage = sinon.stub().rejects(new Error("WhatsApp API error: bad template"));
    const send = createSendApplicationPromo({
      sendTemplateMessage,
      templateName: "loan_application",
      languageCode: "en",
      imageUrl: IMG
    });

    const result = await send({ phone: "+18298717987", flowToken: "app-1" });

    expect(result.sent).to.be.false;
    expect(result.error).to.contain("bad template");
  });
});
