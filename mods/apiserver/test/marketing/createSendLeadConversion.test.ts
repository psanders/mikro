/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { createHash } from "crypto";
import { expect } from "chai";
import sinon from "sinon";
import { createSendLeadConversion } from "../../src/api/marketing/createSendLeadConversion.js";

const sha256 = (v: string) => createHash("sha256").update(v, "utf8").digest("hex");

const okResponse = () => ({ ok: true, status: 200, text: async () => "" }) as any;

const lead = {
  eventId: "evt-1",
  phone: "+18298717987",
  firstName: "  Juana  ",
  lastName: "Pérez",
  fbc: "fb.1.123.abc",
  fbp: "fb.1.456.def",
  clientIpAddress: "200.1.2.3",
  clientUserAgent: "Mozilla/5.0",
  eventSourceUrl: "https://mikro.do/solicitud",
  eventTime: new Date("2026-09-17T12:00:00Z")
};

const configured = { pixelId: "1589718832638204", accessToken: "tok" };

function bodyOf(fetchFn: sinon.SinonStub) {
  return JSON.parse(fetchFn.firstCall.args[1].body).data[0];
}

describe("createSendLeadConversion", () => {
  afterEach(() => sinon.restore());

  it("sends a Lead with the shared event id so Meta dedupes against the browser event", async () => {
    const fetchFn = sinon.stub().resolves(okResponse());
    const send = createSendLeadConversion({ ...configured, fetchFn: fetchFn as any });

    expect(await send(lead)).to.be.true;

    const event = bodyOf(fetchFn);
    expect(event.event_name).to.equal("Lead");
    expect(event.event_id).to.equal("evt-1");
    expect(event.action_source).to.equal("website");
    expect(event.event_time).to.equal(Math.floor(lead.eventTime.getTime() / 1000));
    expect(event.event_source_url).to.equal("https://mikro.do/solicitud");
  });

  it("hashes phone as digits only, and names lowercased and trimmed", async () => {
    const fetchFn = sinon.stub().resolves(okResponse());
    const send = createSendLeadConversion({ ...configured, fetchFn: fetchFn as any });

    await send(lead);

    const { user_data: userData } = bodyOf(fetchFn);
    // Meta's normalization: no "+", no separators, else the hash never matches.
    expect(userData.ph).to.equal(sha256("18298717987"));
    expect(userData.fn).to.equal(sha256("juana"));
    expect(userData.ln).to.equal(sha256("pérez"));
  });

  it("never sends a raw applicant identifier", async () => {
    const fetchFn = sinon.stub().resolves(okResponse());
    const send = createSendLeadConversion({ ...configured, fetchFn: fetchFn as any });

    await send(lead);

    const raw = fetchFn.firstCall.args[1].body as string;
    expect(raw).to.not.contain("18298717987");
    expect(raw).to.not.contain("Juana");
    expect(raw.toLowerCase()).to.not.contain("juana");
    expect(raw).to.not.contain("Pérez");
  });

  it("passes the click and browser cookies through unhashed, as Meta expects", async () => {
    const fetchFn = sinon.stub().resolves(okResponse());
    const send = createSendLeadConversion({ ...configured, fetchFn: fetchFn as any });

    await send(lead);

    const { user_data: userData } = bodyOf(fetchFn);
    expect(userData.fbc).to.equal("fb.1.123.abc");
    expect(userData.fbp).to.equal("fb.1.456.def");
    expect(userData.client_ip_address).to.equal("200.1.2.3");
    expect(userData.client_user_agent).to.equal("Mozilla/5.0");
  });

  it("omits match keys that are missing rather than sending empty values", async () => {
    const fetchFn = sinon.stub().resolves(okResponse());
    const send = createSendLeadConversion({ ...configured, fetchFn: fetchFn as any });

    await send({ ...lead, phone: null, firstName: null, lastName: null, fbc: null });

    const { user_data: userData } = bodyOf(fetchFn);
    expect(userData).to.not.have.property("ph");
    expect(userData).to.not.have.property("fn");
    expect(userData).to.not.have.property("ln");
    expect(userData).to.not.have.property("fbc");
    expect(userData.fbp).to.equal("fb.1.456.def");
  });

  it("does nothing when unconfigured, so dev never reaches Meta", async () => {
    const fetchFn = sinon.stub().resolves(okResponse());
    const send = createSendLeadConversion({
      pixelId: "",
      accessToken: "",
      fetchFn: fetchFn as any
    });

    expect(await send(lead)).to.be.false;
    expect(fetchFn.called).to.be.false;
  });

  it("refuses to send without an event id, which would double-count the lead", async () => {
    const fetchFn = sinon.stub().resolves(okResponse());
    const send = createSendLeadConversion({ ...configured, fetchFn: fetchFn as any });

    expect(await send({ ...lead, eventId: "" })).to.be.false;
    expect(fetchFn.called).to.be.false;
  });

  it("includes the test event code only when set", async () => {
    const plain = sinon.stub().resolves(okResponse());
    await createSendLeadConversion({ ...configured, fetchFn: plain as any })(lead);
    expect(JSON.parse(plain.firstCall.args[1].body)).to.not.have.property("test_event_code");

    const testing = sinon.stub().resolves(okResponse());
    await createSendLeadConversion({
      ...configured,
      testEventCode: "TEST123",
      fetchFn: testing as any
    })(lead);
    expect(JSON.parse(testing.firstCall.args[1].body).test_event_code).to.equal("TEST123");
  });

  it("reports failure without throwing when Meta rejects the event", async () => {
    const fetchFn = sinon.stub().resolves({
      ok: false,
      status: 400,
      text: async () => '{"error":{"message":"Invalid parameter"}}'
    } as any);
    const send = createSendLeadConversion({ ...configured, fetchFn: fetchFn as any });

    expect(await send(lead)).to.be.false;
  });

  it("swallows network errors so a pixel can never fail an application", async () => {
    const fetchFn = sinon.stub().rejects(new Error("ECONNREFUSED"));
    const send = createSendLeadConversion({ ...configured, fetchFn: fetchFn as any });

    expect(await send(lead)).to.be.false;
  });
});
