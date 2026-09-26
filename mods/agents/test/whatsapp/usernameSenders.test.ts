/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * WhatsApp username senders (openspec whatsapp-username-senders): Meta may send
 * a business-scoped user id (BSUID) instead of a phone for a user who hides
 * their number behind a username.
 */
import { expect } from "chai";
import sinon from "sinon";
import {
  handleWhatsAppMessage,
  setMessageProcessor,
  markInitializationComplete,
  resetProcessedMessageIdsForTesting,
  buildSenderIdentity
} from "../../src/whatsapp/handleWhatsAppMessage.js";
import { clearSessionsForTesting } from "../../src/sessions/sessionStore.js";
import { clearGuestConversation } from "../../src/conversations/index.js";
import { createMessageRouter } from "../../src/router/createMessageRouter.js";
import { addressFields, sendMessage } from "../../src/whatsapp/client/sendMessage.js";

const BSUID = "DO.1610031533916997";
const PHONE = "18095550020";
const recentTs = () => String(Math.floor(Date.now() / 1000) - 10);
let seq = 0;

function webhook(message: Record<string, unknown>, contacts?: unknown[]) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              ...(contacts ? { contacts } : {}),
              messages: [{ id: `u-${++seq}`, timestamp: recentTs(), ...message }]
            }
          }
        ]
      }
    ]
  };
}

const usernameText = (body: string) =>
  webhook({ from_user_id: BSUID, type: "text", text: { body } }, [
    { user_id: BSUID, profile: { name: "Topacio", username: "topacio1234" } }
  ]);

function setup(route: unknown, over: Record<string, unknown> = {}) {
  const processor = {
    routeMessage: sinon.stub().resolves(route),
    invokeLLM: sinon.stub().resolves({ text: "respuesta", toolsExecuted: [] }),
    sendWhatsAppMessage: sinon.stub().resolves({ messages: [{ id: "out-1" }] }),
    sendTemplateMessage: sinon.stub().resolves({}),
    downloadMedia: sinon.stub().resolves("data:image/jpeg;base64,/9j/4AAQ"),
    getChatHistoryForUser: sinon.stub().resolves([]),
    addMessageForUser: sinon.stub().resolves(),
    getAgentForProfile: sinon.stub().callsFake((profile: string) => ({
      name: "a",
      profile,
      enabled: true,
      systemPrompt: "p",
      allowedTools: []
    })),
    extendHandoff: sinon.stub().resolves(false),
    openHandoff: sinon.stub().resolves({ opened: true }),
    linkWhatsAppIdentity: sinon.stub().resolves(),
    recordSharedWhatsAppPhone: sinon.stub().resolves(),
    submitApplicationFromFlow: sinon.stub().resolves(),
    ...over
  };
  setMessageProcessor(processor as never);
  markInitializationComplete();
  return processor;
}

describe("WhatsApp username senders", () => {
  beforeEach(() => {
    resetProcessedMessageIdsForTesting();
    clearSessionsForTesting();
    clearGuestConversation(BSUID);
  });
  afterEach(() => sinon.restore());

  describe("buildSenderIdentity", () => {
    it("uses the phone as the address when Meta includes it, and keeps the BSUID", () => {
      const id = buildSenderIdentity(
        { from: PHONE, from_user_id: BSUID, id: "m", timestamp: "1", type: "text" },
        [{ wa_id: PHONE, user_id: BSUID, profile: { username: "ana" } }]
      );
      expect(id).to.deep.equal({ address: PHONE, phone: PHONE, bsuid: BSUID, username: "ana" });
    });

    it("falls back to the BSUID when there is no phone", () => {
      const id = buildSenderIdentity(
        { from_user_id: BSUID, id: "m", timestamp: "1", type: "text" },
        [{ user_id: BSUID, profile: { username: "topacio1234" } }]
      );
      expect(id).to.deep.equal({ address: BSUID, bsuid: BSUID, username: "topacio1234" });
    });

    it("returns null when the message names no sender", () => {
      expect(buildSenderIdentity({ id: "m", timestamp: "1", type: "text" }, [])).to.equal(null);
    });
  });

  describe("webhook handling", () => {
    it("processes a username-only message instead of rejecting the delivery", async () => {
      const p = setup({ type: "guest", phone: BSUID });

      const result = await handleWhatsAppMessage(usernameText("hola"));

      expect(result.messagesProcessed).to.equal(1);
      expect(p.routeMessage.firstCall.args[0]).to.deep.equal({
        address: BSUID,
        bsuid: BSUID,
        username: "topacio1234"
      });
      expect(p.sendWhatsAppMessage.firstCall.args[0].phone).to.equal(BSUID);
    });

    it("skips one malformed message without dropping the others in the delivery", async () => {
      const p = setup({ type: "guest", phone: PHONE });
      const body = webhook({ from: PHONE, type: "text", text: { body: "hola" } });
      (body.entry[0].changes[0].value.messages as unknown[]).unshift({ type: 42 });

      const result = await handleWhatsAppMessage(body);

      expect(result.messagesProcessed).to.equal(1);
      expect(p.invokeLLM.calledOnce).to.be.true;
    });

    it("links the BSUID to the sender's records when Meta shows both", async () => {
      const p = setup({ type: "guest", phone: PHONE });

      await handleWhatsAppMessage(
        webhook({ from: PHONE, from_user_id: BSUID, type: "text", text: { body: "hola" } }, [
          { wa_id: PHONE, user_id: BSUID, profile: { username: "ana" } }
        ])
      );

      expect(
        p.linkWhatsAppIdentity.calledOnceWith({
          phone: "+18095550020",
          bsuid: BSUID,
          username: "ana"
        })
      ).to.be.true;
    });

    it("hands an unmatched username sender to a person, without the LLM", async () => {
      const p = setup({ type: "guest", phone: BSUID, unmatchedUsername: true });

      await handleWhatsAppMessage(usernameText("buenas, info del préstamo"));

      expect(p.invokeLLM.called).to.be.false;
      expect(p.openHandoff.calledOnce).to.be.true;
      expect(p.openHandoff.firstCall.args[0]).to.include({
        phone: BSUID,
        profile: "GUEST",
        whatsappUserId: BSUID,
        username: "topacio1234"
      });
      expect(p.sendWhatsAppMessage.firstCall.args[0]).to.deep.include({ phone: BSUID });
    });

    it("checks an open hand-off by phone OR BSUID", async () => {
      const p = setup(
        { type: "guest", phone: BSUID },
        { extendHandoff: sinon.stub().resolves(true) }
      );

      await handleWhatsAppMessage(usernameText("hola"));

      expect(p.extendHandoff.calledOnceWith({ phone: BSUID, whatsappUserId: BSUID })).to.be.true;
      expect(p.sendWhatsAppMessage.called).to.be.false;
    });

    it("records a phone the sender shared on request, silently", async () => {
      const p = setup({ type: "guest", phone: BSUID });

      await handleWhatsAppMessage(
        webhook(
          {
            from_user_id: BSUID,
            type: "contacts",
            contacts: [{ origin: "contact_request", phones: [{ wa_id: PHONE }] }]
          },
          [{ user_id: BSUID, profile: { username: "topacio1234" } }]
        )
      );

      expect(
        p.recordSharedWhatsAppPhone.calledOnceWith({
          phone: "+18095550020",
          bsuid: BSUID,
          username: "topacio1234"
        })
      ).to.be.true;
      expect(p.sendWhatsAppMessage.called).to.be.false;
      expect(p.routeMessage.called).to.be.false;
    });

    it("does not trust a contact card the sender merely forwarded", async () => {
      const p = setup({ type: "guest", phone: BSUID });

      await handleWhatsAppMessage(
        webhook({
          from_user_id: BSUID,
          type: "contacts",
          contacts: [{ origin: "other", phones: [{ wa_id: PHONE }] }]
        })
      );

      expect(p.recordSharedWhatsAppPhone.called).to.be.false;
    });

    it("submits a WhatsApp Flow from a username sender with the BSUID and no phone", async () => {
      const p = setup({ type: "guest", phone: BSUID });

      await handleWhatsAppMessage(
        webhook(
          {
            from_user_id: BSUID,
            type: "interactive",
            interactive: {
              type: "nfm_reply",
              nfm_reply: { response_json: JSON.stringify({ firstName: "Topacio" }) }
            }
          },
          [{ user_id: BSUID, profile: { username: "topacio1234" } }]
        )
      );

      const [payload, submitter] = p.submitApplicationFromFlow.firstCall.args;
      expect(payload).to.not.have.property("phone");
      expect(payload.firstName).to.equal("Topacio");
      expect(submitter).to.deep.equal({ whatsappUserId: BSUID, whatsappUsername: "topacio1234" });
      expect(p.sendWhatsAppMessage.firstCall.args[0].phone).to.equal(BSUID);
    });
  });

  describe("router", () => {
    const base = {
      getUserByPhone: sinon.stub().resolves(null),
      getCustomerByPhone: sinon.stub().resolves(null),
      getAgentForProfile: sinon.stub().returns(undefined)
    };

    it("matches a username sender to their customer by BSUID", async () => {
      const router = createMessageRouter({
        ...base,
        findCustomerByWhatsAppUserId: sinon
          .stub()
          .resolves({ id: "cust-1", name: "Ana", phone: "+18095550020", isActive: true })
      });
      expect(await router({ address: BSUID, bsuid: BSUID })).to.deep.equal({
        type: "customer",
        customerId: "cust-1",
        name: "Ana",
        phone: BSUID
      });
    });

    it("matches a username sender to their application by BSUID (same status rules)", async () => {
      const router = createMessageRouter({
        ...base,
        findApplicationByWhatsAppUserId: sinon.stub().resolves({
          applicationId: "app-1",
          sessionId: "s-1",
          status: "IN_REVIEW",
          submittedAt: new Date()
        })
      });
      expect(await router({ address: BSUID, bsuid: BSUID })).to.deep.equal({
        type: "applicant",
        applicationId: "app-1",
        sessionId: "s-1",
        phone: BSUID
      });
    });

    it("flags a username sender with no records as unmatched, and never validates it as a phone", async () => {
      const router = createMessageRouter({
        ...base,
        findCustomerByWhatsAppUserId: sinon.stub().resolves(null),
        findApplicationByWhatsAppUserId: sinon.stub().resolves(null)
      });
      expect(await router({ address: BSUID, bsuid: BSUID })).to.deep.equal({
        type: "guest",
        phone: BSUID,
        unmatchedUsername: true
      });
      expect(base.getUserByPhone.called).to.be.false;
    });
  });

  describe("sending to a BSUID", () => {
    it("addresses a phone with `to` and a BSUID with `recipient`", () => {
      expect(addressFields("+18095550020")).to.deep.equal({ to: "+18095550020" });
      expect(addressFields(BSUID)).to.deep.equal({ recipient: BSUID });
    });

    it("sends a text reply to a username sender via `recipient`", async () => {
      const fetchStub = sinon
        .stub(globalThis, "fetch")
        .resolves(new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 }));

      await sendMessage("pnid", "token", { phone: BSUID, message: "hola" });

      const body = JSON.parse(String(fetchStub.firstCall.args[1]?.body));
      expect(body.recipient).to.equal(BSUID);
      expect(body).to.not.have.property("to");
    });
  });
});
