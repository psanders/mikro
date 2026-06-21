/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import {
  handleCollectorMessage,
  clearPendingPromosForTesting
} from "../../src/whatsapp/handleCollectorMessage.js";

const COLLECTOR_PHONE = "+18095550001";
const BUSINESS_PHONE = "+18095551234";

/** Minimal mock LLM result with text only. */
const llmResult = (text: string) => ({ text, toolsExecuted: [] });

function makeDeps(overrides?: Partial<ReturnType<typeof defaultDeps>>) {
  return { ...defaultDeps(), ...overrides };
}

const MOCK_PROMO = {
  templateName: "loan_application",
  languageCode: "en",
  imageUrl: "https://example.com/banner.png"
};

function defaultDeps() {
  return {
    invokeLLM: sinon.stub().resolves(llmResult("NONE")),
    sendWhatsAppMessage: sinon.stub().resolves({ messages: [{ id: "msg-1" }] }),
    sendTemplateMessage: sinon.stub().resolves({ messages: [{ id: "tpl-1" }] }),
    promoTemplate: MOCK_PROMO
  };
}

describe("handleCollectorMessage", () => {
  beforeEach(() => {
    clearPendingPromosForTesting();
  });

  afterEach(() => {
    sinon.restore();
  });

  // -----------------------------------------------------------------------
  // 6.1 Image with valid number → button sent + pending stored
  // -----------------------------------------------------------------------
  describe("image with a valid phone number", () => {
    it("sends a reply-button confirmation and stores the pending promo", async () => {
      const deps = makeDeps({
        // Vision returns Dominican local format
        invokeLLM: sinon.stub().resolves(llmResult("8095551234"))
      });

      await handleCollectorMessage(
        COLLECTOR_PHONE,
        "image",
        "data:image/png;base64,abc",
        undefined,
        deps
      );

      // Should NOT send a template
      expect(deps.sendTemplateMessage.called).to.be.false;
      // Should send the confirmation via sendWhatsAppMessage with replyButtons
      expect(deps.sendWhatsAppMessage.calledOnce).to.be.true;
      const arg = deps.sendWhatsAppMessage.firstCall.args[0];
      expect(arg.phone).to.equal(COLLECTOR_PHONE);
      expect(arg.replyButtons).to.exist;
      expect(arg.replyButtons.buttons).to.have.length(2);
      expect(arg.replyButtons.buttons[0].id).to.equal("yes");
      expect(arg.replyButtons.buttons[1].id).to.equal("no");
      // The body should include the extracted number
      expect(arg.replyButtons.bodyText).to.include(BUSINESS_PHONE);
    });

    it("also works when vision returns full international format", async () => {
      const deps = makeDeps({
        invokeLLM: sinon.stub().resolves(llmResult("18095551234"))
      });

      await handleCollectorMessage(
        COLLECTOR_PHONE,
        "image",
        "data:image/png;base64,abc",
        undefined,
        deps
      );

      const arg = deps.sendWhatsAppMessage.firstCall.args[0];
      expect(arg.replyButtons.bodyText).to.include(BUSINESS_PHONE);
    });
  });

  // -----------------------------------------------------------------------
  // 6.2 Image with no number → error reply, no pending
  // -----------------------------------------------------------------------
  describe("image with no detectable phone number", () => {
    it("sends a 'no number' text reply when vision returns NONE", async () => {
      const deps = makeDeps({
        invokeLLM: sinon.stub().resolves(llmResult("NONE"))
      });

      await handleCollectorMessage(
        COLLECTOR_PHONE,
        "image",
        "data:image/png;base64,abc",
        undefined,
        deps
      );

      expect(deps.sendTemplateMessage.called).to.be.false;
      expect(deps.sendWhatsAppMessage.calledOnce).to.be.true;
      const msg = deps.sendWhatsAppMessage.firstCall.args[0].message as string;
      expect(msg).to.include("No vi ningún número");
      expect(msg).to.include("toma otra foto");
    });

    it("sends an 'invalid number' reply when vision returns unparseable digits", async () => {
      const deps = makeDeps({
        invokeLLM: sinon.stub().resolves(llmResult("12345")) // too short to be valid
      });

      await handleCollectorMessage(
        COLLECTOR_PHONE,
        "image",
        "data:image/png;base64,abc",
        undefined,
        deps
      );

      expect(deps.sendTemplateMessage.called).to.be.false;
      expect(deps.sendWhatsAppMessage.calledOnce).to.be.true;
      const msg = deps.sendWhatsAppMessage.firstCall.args[0].message as string;
      expect(msg).to.include("No pude leer el número");
      expect(msg).to.include("toma otra foto");
    });
  });

  // -----------------------------------------------------------------------
  // 6.3 Button "yes" with pending → promo sent, pending cleared
  // -----------------------------------------------------------------------
  describe("button reply 'yes' with a valid pending entry", () => {
    it("sends the promo template and confirms to the collector", async () => {
      // First create a pending entry by processing an image
      const setupDeps = makeDeps({
        invokeLLM: sinon.stub().resolves(llmResult("8095551234"))
      });
      await handleCollectorMessage(
        COLLECTOR_PHONE,
        "image",
        "data:image/png;base64,abc",
        undefined,
        setupDeps
      );

      // Now tap "yes"
      const deps = makeDeps();
      await handleCollectorMessage(COLLECTOR_PHONE, "interactive", null, "yes", deps);

      expect(deps.sendTemplateMessage.calledOnce).to.be.true;
      const tplArg = deps.sendTemplateMessage.firstCall.args[0];
      expect(tplArg.phone).to.equal(BUSINESS_PHONE);
      expect(tplArg.templateName).to.be.a("string").and.not.empty;
      expect(tplArg.flowToken).to.be.a("string").and.not.empty;

      // Confirm message to collector
      expect(deps.sendWhatsAppMessage.calledOnce).to.be.true;
      const confirmMsg = deps.sendWhatsAppMessage.firstCall.args[0].message as string;
      expect(confirmMsg).to.include("¡Listo!");
      expect(confirmMsg).to.include(BUSINESS_PHONE);
    });

    it("clears the pending entry after sending so a second 'yes' finds nothing", async () => {
      const setupDeps = makeDeps({
        invokeLLM: sinon.stub().resolves(llmResult("8095551234"))
      });
      await handleCollectorMessage(
        COLLECTOR_PHONE,
        "image",
        "data:image/png;base64,abc",
        undefined,
        setupDeps
      );

      const deps = makeDeps();
      await handleCollectorMessage(COLLECTOR_PHONE, "interactive", null, "yes", deps);
      // Second tap — pending is gone
      const deps2 = makeDeps();
      await handleCollectorMessage(COLLECTOR_PHONE, "interactive", null, "yes", deps2);

      expect(deps2.sendTemplateMessage.called).to.be.false;
      const msg = deps2.sendWhatsAppMessage.firstCall.args[0].message as string;
      expect(msg).to.include("No hay ningún número pendiente");
    });
  });

  // -----------------------------------------------------------------------
  // 6.4 Button "no" with pending → no promo, pending cleared
  // -----------------------------------------------------------------------
  describe("button reply 'no' with a valid pending entry", () => {
    it("sends a cancel confirmation without sending any template", async () => {
      const setupDeps = makeDeps({
        invokeLLM: sinon.stub().resolves(llmResult("8095551234"))
      });
      await handleCollectorMessage(
        COLLECTOR_PHONE,
        "image",
        "data:image/png;base64,abc",
        undefined,
        setupDeps
      );

      const deps = makeDeps();
      await handleCollectorMessage(COLLECTOR_PHONE, "interactive", null, "no", deps);

      expect(deps.sendTemplateMessage.called).to.be.false;
      expect(deps.sendWhatsAppMessage.calledOnce).to.be.true;
      const msg = deps.sendWhatsAppMessage.firstCall.args[0].message as string;
      expect(msg).to.include("Ok, no envié nada");
    });
  });

  // -----------------------------------------------------------------------
  // 6.5 Button reply with expired/missing pending → no-pending reply
  // -----------------------------------------------------------------------
  describe("button reply with no pending entry", () => {
    it("informs the collector there is nothing pending", async () => {
      const deps = makeDeps();
      await handleCollectorMessage(COLLECTOR_PHONE, "interactive", null, "yes", deps);

      expect(deps.sendTemplateMessage.called).to.be.false;
      expect(deps.sendWhatsAppMessage.calledOnce).to.be.true;
      const msg = deps.sendWhatsAppMessage.firstCall.args[0].message as string;
      expect(msg).to.include("No hay ningún número pendiente");
    });
  });

  // -----------------------------------------------------------------------
  // 6.6 Non-image, non-button → guidance reply
  // -----------------------------------------------------------------------
  describe("non-image non-button messages", () => {
    it("replies with guidance when collector sends a text message", async () => {
      const deps = makeDeps();
      await handleCollectorMessage(COLLECTOR_PHONE, "text", null, undefined, deps);

      expect(deps.invokeLLM.called).to.be.false;
      expect(deps.sendTemplateMessage.called).to.be.false;
      expect(deps.sendWhatsAppMessage.calledOnce).to.be.true;
      const msg = deps.sendWhatsAppMessage.firstCall.args[0].message as string;
      expect(msg).to.include("Solo puedo ayudarte");
      expect(msg).to.include("foto");
    });

    it("replies with guidance for audio messages", async () => {
      const deps = makeDeps();
      await handleCollectorMessage(COLLECTOR_PHONE, "audio", null, undefined, deps);

      const msg = deps.sendWhatsAppMessage.firstCall.args[0].message as string;
      expect(msg).to.include("Solo puedo ayudarte");
    });
  });
});
