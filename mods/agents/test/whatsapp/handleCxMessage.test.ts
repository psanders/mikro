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
import { createFakeTranscript } from "./fakeTranscript.js";

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

function setup(
  route: unknown,
  over: Record<string, unknown> = {},
  transcript = createFakeTranscript()
) {
  const processor = {
    recordConversationTurn: transcript.recordConversationTurn,
    getConversationHistory: transcript.getConversationHistory,
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
  return Object.assign(processor, { turns: transcript.turns });
}

describe("WhatsApp CX routes", () => {
  beforeEach(() => {
    resetProcessedMessageIdsForTesting();
    clearSessionsForTesting();
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
      // No agent summarized, so the Chatwoot note gets the last turns.
      expect(p.openHandoff.firstCall.args[0].recentMessages).to.deep.equal([
        { role: "user", content: "Quiero hablar con una persona por favor" }
      ]);
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
        reason: "Solicitud anterior no aprobada",
        recentMessages: [{ role: "user", content: "hola, quiero volver a aplicar" }]
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

  // Issue #299: every CX message is persisted for monitoring and agent evals,
  // and the agents' memory is read back from that transcript.
  describe("transcript", () => {
    it("records the inbound message and the agent's reply with its identity and tools", async () => {
      const p = setup(customerRoute, {
        invokeLLM: sinon.stub().resolves({
          text: "Debes 1,500",
          toolsExecuted: [{ name: "getBalance", args: { loanId: 10034 } }]
        })
      });

      await handleWhatsAppMessage(textWebhook("¿cuánto debo?"));

      expect(p.turns.map((t) => t.role)).to.deep.equal(["INBOUND", "AGENT"]);
      const [inbound, reply] = p.turns;
      expect(inbound).to.include({
        phone: PHONE,
        content: "¿cuánto debo?",
        profile: "CUSTOMER",
        customerId: "cust-1",
        hasImage: false
      });
      expect(inbound.waMessageId).to.match(/^cx-/);
      expect(reply).to.include({
        phone: PHONE,
        content: "Debes 1,500",
        profile: "CUSTOMER",
        customerId: "cust-1",
        agentName: "customer-agent",
        waMessageId: "out-1"
      });
      expect(reply.agentVersion).to.match(/^[0-9a-f]{12}$/);
      expect(reply.toolCalls).to.deep.equal([{ name: "getBalance", args: { loanId: 10034 } }]);
    });

    it("records a message the agent stays silent on (hand-off open)", async () => {
      const p = setup(customerRoute, { extendHandoff: sinon.stub().resolves(true) });

      await handleWhatsAppMessage(textWebhook("¿hola?"));

      expect(p.turns.map((t) => t.role)).to.deep.equal(["INBOUND"]);
    });

    it("records the hand-off acknowledgment as a SYSTEM turn", async () => {
      const p = setup(customerRoute);

      await handleWhatsAppMessage(textWebhook("Quiero hablar con una persona"));

      expect(p.turns.map((t) => t.role)).to.deep.equal(["INBOUND", "SYSTEM"]);
      expect(p.turns[1].content).to.match(/equipo/);
      expect(p.turns[1].agentName).to.equal(undefined);
    });

    it("records an image by its caption and a flag, never the media", async () => {
      const p = setup(applicantRoute);

      await handleWhatsAppMessage(imageWebhook());

      expect(p.turns[0]).to.include({
        content: "mi negocio",
        hasImage: true,
        applicationId: "app-1"
      });
    });

    it("gives the agent the earlier conversation, without the current message", async () => {
      const p = setup({ type: "guest", phone: PHONE });

      await handleWhatsAppMessage(textWebhook("hola"));
      await handleWhatsAppMessage(textWebhook("¿y los requisitos?"));

      expect(p.invokeLLM.firstCall.args[1]).to.deep.equal([]);
      expect(p.invokeLLM.secondCall.args[1]).to.deep.equal([
        { role: "user", content: "hola" },
        { role: "assistant", content: "respuesta" }
      ]);
      expect(p.invokeLLM.secondCall.args[2]).to.equal("¿y los requisitos?");
    });

    it("remembers a conversation from before a restart (history comes from storage)", async () => {
      const stored = createFakeTranscript([
        { phone: PHONE, role: "INBOUND", content: "me llamo Ana", profile: "GUEST" },
        { phone: PHONE, role: "AGENT", content: "¡Hola Ana!", profile: "GUEST" }
      ]);
      const p = setup({ type: "guest", phone: PHONE }, {}, stored);

      await handleWhatsAppMessage(textWebhook("¿recuerdas mi nombre?"));

      expect(p.invokeLLM.firstCall.args[1]).to.deep.equal([
        { role: "user", content: "me llamo Ana" },
        { role: "assistant", content: "¡Hola Ana!" }
      ]);
    });

    it("puts earlier turns in the hand-off note", async () => {
      const stored = createFakeTranscript([
        { phone: PHONE, role: "INBOUND", content: "hola", profile: "CUSTOMER" },
        { phone: PHONE, role: "AGENT", content: "¿en qué te ayudo?", profile: "CUSTOMER" }
      ]);
      const p = setup(customerRoute, {}, stored);

      await handleWhatsAppMessage(textWebhook("Quiero hablar con una persona"));

      expect(p.openHandoff.firstCall.args[0].recentMessages).to.deep.equal([
        { role: "user", content: "hola" },
        { role: "assistant", content: "¿en qué te ayudo?" },
        { role: "user", content: "Quiero hablar con una persona" }
      ]);
    });

    it("tags José's turns with the application and reads José's own history", async () => {
      const p = setup(prospectRoute, {
        invokeLLM: sinon.stub().resolves({
          text: "Anotado",
          toolsExecuted: [{ name: "saveAnswer", args: { field: "monthlySales", value: 50000 } }]
        })
      });

      await handleWhatsAppMessage(textWebhook("vendo 50 mil"));

      expect(p.turns[1]).to.include({
        role: "AGENT",
        profile: "PROSPECT",
        applicationId: "app-1"
      });
      expect(p.getConversationHistory.firstCall.args[0]).to.include({
        scope: "prospect",
        applicationId: "app-1"
      });
    });

    it("still replies when the transcript write fails", async () => {
      const p = setup(customerRoute, {
        recordConversationTurn: sinon.stub().rejects(new Error("disk full"))
      });

      await handleWhatsAppMessage(textWebhook("¿cuánto debo?"));

      expect(p.sendWhatsAppMessage.calledOnce).to.be.true;
      expect(p.sendWhatsAppMessage.firstCall.args[0].message).to.equal("respuesta");
    });

    it("records a failed send, without a wamid", async () => {
      const p = setup(customerRoute, {
        sendWhatsAppMessage: sinon.stub().rejects(new Error("meta down"))
      });

      await handleWhatsAppMessage(textWebhook("¿cuánto debo?"));

      const agentTurn = p.turns.find((t) => t.role === "AGENT");
      expect(agentTurn).to.include({ content: "respuesta", waMessageId: undefined });
    });

    it("records the voice-note notice as a SYSTEM turn", async () => {
      const p = setup(customerRoute);

      await handleWhatsAppMessage(voiceWebhook());

      expect(p.turns.map((t) => [t.role, t.content])).to.deep.equal([
        ["INBOUND", "[Nota de voz]"],
        ["SYSTEM", "No puedo escuchar notas de voz. Por favor, escríbeme un mensaje de texto."]
      ]);
    });

    it("leaves staff conversations out of the CX transcript", async () => {
      const p = setup({ type: "user", userId: "u-1", name: "Ana", role: "ADMIN", phone: PHONE });

      await handleWhatsAppMessage(textWebhook("hola"));

      expect(p.turns).to.deep.equal([]);
    });
  });
});
