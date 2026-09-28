/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createNotifyRejection } from "../../src/api/applications/createNotifyRejection.js";

const CFG = {
  accountSid: "AC123",
  authToken: "secret",
  from: "+18095550000",
  rejectionMessage: "Lo sentimos, su solicitud no fue aprobada."
};

describe("createNotifyRejection", () => {
  it("texts the configured message, unchanged, to the applicant's phone", async () => {
    const fetchFn = sinon.stub().resolves(new Response("{}", { status: 201 }));
    const sent = await createNotifyRejection({ ...CFG, fetchFn })({
      id: "app1",
      phone: "+18095551234"
    });

    expect(sent).to.equal(true);
    const form = new URLSearchParams(String((fetchFn.firstCall.args[1] as RequestInit).body));
    expect(form.get("To")).to.equal("+18095551234");
    expect(form.get("Body")).to.equal(CFG.rejectionMessage);
  });

  it("skips applicants without a phone", async () => {
    const fetchFn = sinon.stub();
    const sent = await createNotifyRejection({ ...CFG, fetchFn })({ id: "app1", phone: null });
    expect(sent).to.equal(false);
    expect(fetchFn.called).to.equal(false);
  });

  it("is off when no rejection message is configured", async () => {
    const fetchFn = sinon.stub();
    const sent = await createNotifyRejection({ ...CFG, rejectionMessage: "", fetchFn })({
      id: "app1",
      phone: "+18095551234"
    });
    expect(sent).to.equal(false);
    expect(fetchFn.called).to.equal(false);
  });
});
