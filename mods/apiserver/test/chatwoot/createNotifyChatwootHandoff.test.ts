/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import {
  buildHandoffNote,
  createNotifyChatwootHandoff,
  HANDOFF_LABEL
} from "../../src/api/chatwoot/createNotifyChatwootHandoff.js";

const PHONE = "+18095550010";
const CFG = { url: "https://cw.example.com/", accountId: 1, inboxId: 7, apiToken: "tok" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

/** A fake Chatwoot with one contact, one open conversation (#42) and label "vip". */
function fakeChatwoot() {
  const calls: Array<{ method: string; path: string; body?: unknown }> = [];
  const fetchFn = sinon.stub().callsFake(async (url: string, init?: RequestInit) => {
    const path = url.replace("https://cw.example.com/api/v1/accounts/1", "");
    const method = init?.method ?? "GET";
    calls.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (path.startsWith("/contacts/search"))
      return json({ payload: [{ id: 5, phone_number: PHONE }] });
    if (path === "/contacts/5/conversations")
      return json({ payload: [{ id: 42, inbox_id: 7, status: "open", last_activity_at: 1 }] });
    if (path === "/conversations/42/labels" && method === "GET") return json({ payload: ["vip"] });
    return json({});
  });
  return { fetchFn, calls };
}

describe("buildHandoffNote", () => {
  it("leads with who and why, then the agent's summary", () => {
    const note = buildHandoffNote({
      phone: PHONE,
      profile: "CUSTOMER",
      reason: "quiere un arreglo de pago",
      summary: "Debe 2 cuotas. Pide pagar la mitad este viernes.",
      name: "Ana López",
      loanIds: [10034]
    });
    expect(note).to.contain("Quién: Ana López · Cliente");
    expect(note).to.contain("Motivo: quiere un arreglo de pago");
    expect(note).to.contain("Préstamos activos: #10034");
    expect(note).to.contain("Resumen:\nDebe 2 cuotas.");
    expect(note).to.not.contain("Últimos mensajes");
  });

  it("falls back to the last messages when no agent summarized", () => {
    const note = buildHandoffNote({
      phone: PHONE,
      profile: "GUEST",
      reason: "Solicitud anterior no aprobada",
      application: { id: "app-1", status: "REJECTED", businessName: "Colmado Ana" },
      recentMessages: [
        { role: "assistant", content: "Hola" },
        { role: "user", content: "quiero volver a aplicar" }
      ]
    });
    expect(note).to.contain("Solicitud: rechazada · Colmado Ana (id app-1)");
    expect(note).to.contain("Bot: Hola");
    expect(note).to.contain("Persona: quiero volver a aplicar");
  });
});

describe("createNotifyChatwootHandoff", () => {
  afterEach(() => sinon.restore());

  it("posts a private note and adds the handoff label, keeping existing labels", async () => {
    const { fetchFn, calls } = fakeChatwoot();
    const lookupFacts = sinon.stub().resolves({ name: "Ana López", loanIds: [10034] });
    const notify = createNotifyChatwootHandoff({ ...CFG, fetchFn, lookupFacts });

    const ok = await notify({
      phone: PHONE,
      profile: "CUSTOMER",
      reason: "arreglo de pago",
      summary: "Resumen corto.",
      customerId: "cust-1"
    });

    expect(ok).to.be.true;
    expect(lookupFacts.calledOnceWith({ applicationId: undefined, customerId: "cust-1" })).to.be
      .true;
    const note = calls.find((c) => c.path === "/conversations/42/messages");
    expect(note?.body).to.include({ message_type: "outgoing", private: true });
    expect((note?.body as { content: string }).content).to.contain("Resumen corto.");
    expect((note?.body as Record<string, unknown>).source_id).to.equal(undefined);
    const labels = calls.find((c) => c.path === "/conversations/42/labels" && c.method === "POST");
    expect(labels?.body).to.deep.equal({ labels: ["vip", HANDOFF_LABEL] });
  });

  it("does nothing when Chatwoot is not configured", async () => {
    const fetchFn = sinon.stub();
    const notify = createNotifyChatwootHandoff({
      url: "",
      accountId: 0,
      inboxId: 0,
      apiToken: "",
      fetchFn,
      lookupFacts: sinon.stub().resolves({})
    });
    expect(await notify({ phone: PHONE, profile: "GUEST", reason: "x" })).to.be.false;
    expect(fetchFn.called).to.be.false;
  });

  it("never throws when Chatwoot fails", async () => {
    const fetchFn = sinon.stub().resolves(json({ error: "boom" }, 500));
    const notify = createNotifyChatwootHandoff({
      ...CFG,
      fetchFn,
      attempts: 1,
      lookupFacts: sinon.stub().resolves({})
    });
    expect(await notify({ phone: PHONE, profile: "GUEST", reason: "x" })).to.be.false;
  });
});
