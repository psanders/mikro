/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * WhatsApp CX routes (openspec cx-role-based-agents): guests, prospects,
 * applicants and customers, the human hand-off gate and the reopen path.
 */
import { expect } from "chai";
import sinon from "sinon";
import {
  handleWhatsAppMessage,
  setMessageProcessor,
  markInitializationComplete,
  resetProcessedMessageIdsForTesting,
  isHumanRequest
} from "../../src/whatsapp/handleWhatsAppMessage.js";
import { clearSessionsForTesting } from "../../src/sessions/sessionStore.js";
import { clearGuestConversation } from "../../src/conversations/index.js";

const PHONE = "+18095550010";
const recentTs = () => String(Math.floor(Date.now() / 1000) - 10);
let seq = 0;

function textWebhook(body: string) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from: PHONE,
                  type: "text",
                  id: `cx-${++seq}`,
                  timestamp: recentTs(),
                  text: { body }
                }
              ]
            }
          }
        ]
      }
    ]
  };
}

function imageWebhook() {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from: PHONE,
                  type: "image",
                  id: `cx-${++seq}`,
                  timestamp: recentTs(),
                  image: { id: "media-1", caption: "mi negocio" }
                }
              ]
            }
          }
        ]
      }
    ]
  };
}

function voiceWebhook() {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from: PHONE,
                  type: "audio",
                  id: `cx-${++seq}`,
                  timestamp: recentTs(),
                  audio: { id: "audio-1" }
                }
              ]
            }
          }
        ]
      }
    ]
  };
}

const agentFor = (profile: string) => ({
  name: `${profile.toLowerCase()}-agent`,
  profile,
  enabled: true,
  systemPrompt: "prompt",
  allowedTools: []
});

const applicantRoute = {
  type: "applicant" as const,
  applicationId: "app-1",
  sessionId: "s-1",
  phone: PHONE
};
const customerRoute = {
  type: "customer" as const,
  customerId: "cust-1",
  name: "Ana López",
  phone: PHONE
};
const prospectRoute = {
  type: "prospect" as const,
  applicationId: "app-1",
  sessionId: "s-1",
  phone: PHONE
};

function setup(route: unknown, over: Record<string, unknown> = {}) {
  const processor = {
    routeMessage: sinon.stub().resolves(route),
    invokeLLM: sinon.stub().resolves({ text: "respuesta", toolsExecuted: [] }),
    sendWhatsAppMessage: sinon.stub().resolves({ messages: [{ id: "out-1" }] }),
    sendTemplateMessage: sinon.stub().resolves({}),
    downloadMedia: sinon.stub().resolves("data:image/jpeg;base64,/9j/4AAQ"),
    getChatHistoryForUser: sinon.stub().resolves([]),
    addMessageForUser: sinon.stub().resolves(),
    getAgentForProfile: sinon.stub().callsFake((p: string) => agentFor(p)),
    recordProspectActivity: sinon.stub().resolves(),
    reopenApplication: sinon.stub().resolves(true),
    extendHandoff: sinon.stub().resolves(false),
    openHandoff: sinon.stub().resolves({ opened: true }),
    ...over
  };
  setMessageProcessor(processor as never);
  markInitializationComplete();
  return processor;
}

describe("WhatsApp CX routes", () => {
  beforeEach(() => {
    resetProcessedMessageIdsForTesting();
    clearSessionsForTesting();
    clearGuestConversation(PHONE);
  });
  afterEach(() => sinon.restore());

  describe("human hand-off", () => {
    it("stays silent while a hand-off is open, and extends it", async () => {
      const p = setup(customerRoute, { extendHandoff: sinon.stub().resolves(true) });

      await handleWhatsAppMessage(textWebhook("¿hola?"));

      expect(p.extendHandoff.calledOnceWith(PHONE)).to.be.true;
      expect(p.invokeLLM.called).to.be.false;
      expect(p.sendWhatsAppMessage.called).to.be.false;
    });

    it("still records prospect activity during a hand-off", async () => {
      const p = setup(prospectRoute, { extendHandoff: sinon.stub().resolves(true) });

      await handleWhatsAppMessage(textWebhook("sigo aquí"));

      expect(p.recordProspectActivity.calledOnceWith("app-1")).to.be.true;
      expect(p.sendWhatsAppMessage.called).to.be.false;
    });

    it("opens a hand-off on an explicit request, acknowledges, and skips the LLM", async () => {
      const p = setup(customerRoute);

      await handleWhatsAppMessage(textWebhook("Quiero hablar con una persona por favor"));

      expect(p.openHandoff.calledOnce).to.be.true;
      expect(p.openHandoff.firstCall.args[0]).to.include({
        phone: PHONE,
        profile: "CUSTOMER",
        customerId: "cust-1",
        displayName: "Ana López"
      });
      expect(p.invokeLLM.called).to.be.false;
      expect(p.sendWhatsAppMessage.calledOnce).to.be.true;
      expect(p.sendWhatsAppMessage.firstCall.args[0].message).to.match(/equipo/);
    });

    it("lets an opt-out win over a request for a person (José closes it)", async () => {
      const p = setup(prospectRoute);

      await handleWhatsAppMessage(
        textWebhook("no me interesa, quiero hablar con una persona para cancelar")
      );

      expect(p.openHandoff.called).to.be.false;
      expect(p.invokeLLM.calledOnce).to.be.true;
    });

    it("recognizes explicit requests and ignores passing mentions", () => {
      for (const yes of [
        "quiero hablar con una persona",
        "Pásame con un asesor",
        "necesito hablar con alguien",
        "me gustaría hablar con un agente",
        "puedo hablar con un humano?"
      ]) {
        expect(isHumanRequest(yes), yes).to.be.true;
      }
      for (const no of [
        "mi asesor me dijo que pagara el lunes",
        "hablé con una persona ayer",
        "¿cuánto debo?",
        "la persona que me visitó fue amable"
      ]) {
        expect(isHumanRequest(no), no).to.be.false;
      }
    });
  });

  describe("prospects", () => {
    it("restarts the abandon clock and hands the turn to José", async () => {
      const p = setup(prospectRoute);

      await handleWhatsAppMessage(textWebhook("vendo unos 50 mil al mes"));

      expect(p.recordProspectActivity.calledOnceWith("app-1")).to.be.true;
      expect(p.invokeLLM.calledOnce).to.be.true;
      const ctx = p.invokeLLM.firstCall.args[4];
      expect(ctx).to.include({ sessionId: "s-1", profile: "PROSPECT", applicationId: "app-1" });
    });

    it("reopens a never-submitted abandoned draft, then runs José", async () => {
      const p = setup({ ...prospectRoute, type: "reopen" });

      await handleWhatsAppMessage(textWebhook("hola, quiero seguir"));

      expect(p.reopenApplication.calledOnceWith("app-1")).to.be.true;
      expect(p.invokeLLM.calledOnce).to.be.true;
      expect(p.sendWhatsAppMessage.calledOnce).to.be.true;
    });

    it("stays silent when the reopen is refused", async () => {
      const p = setup(
        { ...prospectRoute, type: "reopen" },
        { reopenApplication: sinon.stub().resolves(false) }
      );

      await handleWhatsAppMessage(textWebhook("hola"));

      expect(p.invokeLLM.called).to.be.false;
      expect(p.sendWhatsAppMessage.called).to.be.false;
    });
  });

  describe("applicants", () => {
    it("answers through the APPLICANT agent, not the old hold message", async () => {
      const p = setup(applicantRoute);

      await handleWhatsAppMessage(textWebhook("¿cómo va mi solicitud?"));

      expect(p.getAgentForProfile.calledWith("APPLICANT")).to.be.true;
      const ctx = p.invokeLLM.firstCall.args[4];
      expect(ctx).to.deep.equal({
        phone: PHONE,
        profile: "APPLICANT",
        applicationId: "app-1",
        sessionId: "s-1"
      });
      expect(p.sendWhatsAppMessage.firstCall.args[0].message).to.equal("respuesta");
    });

    it("passes the turn's photo to the tools through context", async () => {
      const p = setup(applicantRoute);

      await handleWhatsAppMessage(imageWebhook());

      const ctx = p.invokeLLM.firstCall.args[4];
      expect(ctx.imageDataUrl).to.equal("data:image/jpeg;base64,/9j/4AAQ");
    });
  });

  describe("customers and guests", () => {
    it("gives the CUSTOMER agent the customer's identity", async () => {
      const p = setup(customerRoute);

      await handleWhatsAppMessage(textWebhook("¿cuánto debo?"));

      expect(p.invokeLLM.firstCall.args[4]).to.deep.equal({
        phone: PHONE,
        profile: "CUSTOMER",
        customerId: "cust-1",
        name: "Ana López"
      });
    });

    it("does not reply when no agent is assigned to the profile", async () => {
      const p = setup(customerRoute, { getAgentForProfile: sinon.stub().returns(undefined) });

      await handleWhatsAppMessage(textWebhook("quiero hablar con una persona"));

      expect(p.invokeLLM.called).to.be.false;
      expect(p.openHandoff.called).to.be.false;
      expect(p.sendWhatsAppMessage.called).to.be.false;
    });

    it("hands a previously rejected guest to a person, without the LLM", async () => {
      const p = setup({ type: "guest", phone: PHONE, previouslyRejected: true });

      await handleWhatsAppMessage(textWebhook("hola, quiero volver a aplicar"));

      expect(p.openHandoff.calledOnce).to.be.true;
      expect(p.openHandoff.firstCall.args[0]).to.deep.equal({
        phone: PHONE,
        profile: "GUEST",
        reason: "Solicitud anterior no aprobada"
      });
      expect(p.invokeLLM.called).to.be.false;
      expect(p.sendWhatsAppMessage.firstCall.args[0].message).to.match(/no fue aprobada/);
    });

    it("gives Carmen a returning customer's new application", async () => {
      const p = setup({ ...customerRoute, applicationId: "app-2" });

      await handleWhatsAppMessage(textWebhook("¿cómo va mi nueva solicitud?"));

      expect(p.invokeLLM.firstCall.args[4]).to.deep.equal({
        phone: PHONE,
        profile: "CUSTOMER",
        customerId: "cust-1",
        name: "Ana López",
        applicationId: "app-2"
      });
    });

    it("answers a guest through the GUEST agent", async () => {
      const p = setup({ type: "guest", phone: PHONE });

      await handleWhatsAppMessage(textWebhook("¿qué necesito para un préstamo?"));

      expect(p.getAgentForProfile.calledWith("GUEST")).to.be.true;
      expect(p.invokeLLM.firstCall.args[4]).to.deep.equal({ phone: PHONE, profile: "GUEST" });
    });
  });

  // Code review: an unusable voice note used to reply before routing, past an
  // open hand-off, and without counting as prospect activity.
  describe("voice notes we cannot transcribe", () => {
    it("stay silent during an open hand-off, and extend it", async () => {
      const p = setup(customerRoute, { extendHandoff: sinon.stub().resolves(true) });

      await handleWhatsAppMessage(voiceWebhook());

      expect(p.extendHandoff.calledOnceWith(PHONE)).to.be.true;
      expect(p.sendWhatsAppMessage.called).to.be.false;
    });

    it("still restart a prospect's abandon clock, then send the notice", async () => {
      const p = setup(prospectRoute);

      await handleWhatsAppMessage(voiceWebhook());

      expect(p.recordProspectActivity.calledOnceWith("app-1")).to.be.true;
      expect(p.invokeLLM.called).to.be.false;
      expect(p.sendWhatsAppMessage.calledOnce).to.be.true;
      expect(p.sendWhatsAppMessage.firstCall.args[0].message).to.match(/notas de voz/);
    });

    it("send no notice when no agent serves the profile", async () => {
      const p = setup(customerRoute, { getAgentForProfile: sinon.stub().returns(undefined) });

      await handleWhatsAppMessage(voiceWebhook());

      expect(p.sendWhatsAppMessage.called).to.be.false;
    });
  });
});
