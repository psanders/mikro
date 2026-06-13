/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createSubmitApplicationFromFlow } from "../../src/api/applications/createSubmitApplicationFromFlow.js";

const flowPayload = (over: Record<string, string | boolean> = {}) => ({
  sessionId: "wa-msg-1",
  partial: false,
  phone: "8298717987",
  firstName: "María",
  ...over
});

describe("createSubmitApplicationFromFlow", () => {
  afterEach(() => sinon.restore());

  it("merges into an existing application for the same phone (reuses its sessionId)", async () => {
    const upsertApplication = sinon.stub().resolves({});
    const findLatestApplicationByPhone = sinon.stub().resolves({ sessionId: "manual-sess-9" });
    const submit = createSubmitApplicationFromFlow({
      upsertApplication,
      findLatestApplicationByPhone
    });

    await submit(flowPayload());

    expect(findLatestApplicationByPhone.calledOnceWith("+18298717987")).to.be.true;
    expect(upsertApplication.calledOnce).to.be.true;
    expect(upsertApplication.firstCall.args[0].sessionId).to.equal("manual-sess-9");
  });

  it("creates a new row under the incoming sessionId when no phone match exists", async () => {
    const upsertApplication = sinon.stub().resolves({});
    const findLatestApplicationByPhone = sinon.stub().resolves(null);
    const submit = createSubmitApplicationFromFlow({
      upsertApplication,
      findLatestApplicationByPhone
    });

    await submit(flowPayload({ sessionId: "wa-fresh" }));

    expect(upsertApplication.firstCall.args[0].sessionId).to.equal("wa-fresh");
  });

  it("uses the canonical E.164 phone as the correlation key", async () => {
    const upsertApplication = sinon.stub().resolves({});
    const findLatestApplicationByPhone = sinon.stub().resolves(null);
    const submit = createSubmitApplicationFromFlow({
      upsertApplication,
      findLatestApplicationByPhone
    });

    // "(829) 871-7987" and "8298717987" must canonicalize to the same key.
    await submit(flowPayload({ phone: "(829) 871-7987" }));

    expect(findLatestApplicationByPhone.calledOnceWith("+18298717987")).to.be.true;
  });

  it("does not consult phone correlation when the payload is invalid", async () => {
    const upsertApplication = sinon.stub().resolves({});
    const findLatestApplicationByPhone = sinon.stub().resolves(null);
    const submit = createSubmitApplicationFromFlow({
      upsertApplication,
      findLatestApplicationByPhone
    });

    // Missing sessionId → invalid payload, nothing persisted.
    await submit({ partial: false, phone: "8298717987" } as Record<string, string | boolean>);

    expect(upsertApplication.called).to.be.false;
    expect(findLatestApplicationByPhone.called).to.be.false;
  });
});
