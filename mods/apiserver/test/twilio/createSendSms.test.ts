/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createSendSms } from "../../src/api/twilio/createSendSms.js";

const CFG = { accountSid: "AC123", authToken: "secret", from: "+18095550000" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("createSendSms", () => {
  it("posts the message to Twilio with basic auth", async () => {
    const fetchFn = sinon.stub().resolves(json({ sid: "SM1" }, 201));
    const sent = await createSendSms({ ...CFG, fetchFn })("+18095551234", "Hola");

    expect(sent).to.equal(true);
    const [url, init] = fetchFn.firstCall.args as [string, RequestInit];
    expect(url).to.equal("https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json");
    expect(init.method).to.equal("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).to.equal(
      `Basic ${Buffer.from("AC123:secret").toString("base64")}`
    );
    const form = new URLSearchParams(String(init.body));
    expect(form.get("To")).to.equal("+18095551234");
    expect(form.get("Body")).to.equal("Hola");
    expect(form.get("From")).to.equal("+18095550000");
    expect(form.has("MessagingServiceSid")).to.equal(false);
  });

  it("sends through a Messaging Service when from is an MG sid", async () => {
    const fetchFn = sinon.stub().resolves(json({ sid: "SM1" }, 201));
    await createSendSms({ ...CFG, from: "MG999", fetchFn })("+18095551234", "Hola");

    const form = new URLSearchParams(String((fetchFn.firstCall.args[1] as RequestInit).body));
    expect(form.get("MessagingServiceSid")).to.equal("MG999");
    expect(form.has("From")).to.equal(false);
  });

  it("does nothing when unconfigured", async () => {
    const fetchFn = sinon.stub();
    const sent = await createSendSms({ ...CFG, authToken: "", fetchFn })("+18095551234", "Hola");
    expect(sent).to.equal(false);
    expect(fetchFn.called).to.equal(false);
  });

  it("returns false without throwing when Twilio rejects the message", async () => {
    const fetchFn = sinon.stub().resolves(json({ code: 21211, message: "Invalid 'To'" }, 400));
    const sent = await createSendSms({ ...CFG, fetchFn })("bad", "Hola");
    expect(sent).to.equal(false);
  });

  it("returns false without throwing on a network error", async () => {
    const fetchFn = sinon.stub().rejects(new Error("ECONNRESET"));
    const sent = await createSendSms({ ...CFG, fetchFn })("+18095551234", "Hola");
    expect(sent).to.equal(false);
  });
});
