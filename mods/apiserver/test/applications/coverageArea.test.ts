/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Out-of-coverage-area auto-reject for the website intake: a completed
 * submission from a province Mikro doesn't lend in is stored REJECTED, gets no
 * follow-up nudge, is not reported to Meta as a Lead, and the site is told so
 * via `outcome: "out_of_area"`. Partial autosaves never reject, and an upsert
 * built without `coveredProvinces` (the WhatsApp paths) never does either.
 */
import { expect } from "chai";
import sinon from "sinon";
import {
  createUpsertApplication,
  OUT_OF_COVERAGE_AREA
} from "../../src/api/applications/createUpsertApplication.js";
import { createApplicationIntakeHandler } from "../../src/api/applications/createApplicationIntakeHandler.js";
import type { NormalizedApplication } from "@mikro/common";

const COVERED = ["PUERTO_PLATA"];

function makeNormalized(overrides: Partial<NormalizedApplication> = {}): NormalizedApplication {
  return {
    sessionId: "sess-cov",
    partial: false,
    lastSection: null,
    rawData: {},
    firstName: "Ana",
    lastName: "López",
    phone: "+18298717987",
    idNumber: null,
    dateOfBirth: null,
    maritalStatus: null,
    businessType: null,
    businessName: null,
    requestedAmount: null,
    purpose: null,
    requestedTermWeeks: null,
    province: null,
    homeAddress: null,
    ...overrides
  };
}

/** A db client whose upsert echoes back what it was asked to write. */
function echoClient() {
  const upsert = sinon.stub().callsFake(async (args: any) => ({
    id: "app-1",
    ...args.create
  }));
  return { client: { loanApplication: { upsert, findFirst: async () => null } } as any, upsert };
}

describe("createUpsertApplication — coverage area", () => {
  afterEach(() => sinon.restore());

  it("stores an in-area final submission as RECEIVED and schedules the nudge", async () => {
    const { client, upsert } = echoClient();
    const scheduleFollowUpJob = sinon.stub().resolves();
    const save = createUpsertApplication(client, {
      scheduleFollowUpJob,
      coveredProvinces: COVERED
    });

    const app = await save(makeNormalized({ province: "PUERTO_PLATA" }));

    expect(app.status).to.equal("RECEIVED");
    expect(upsert.firstCall.args[0].update).to.not.have.property("reviewNote");
    expect(scheduleFollowUpJob.calledOnceWith("app-1")).to.equal(true);
  });

  it("rejects an out-of-area final submission with a reason and no nudge", async () => {
    const { client, upsert } = echoClient();
    const scheduleFollowUpJob = sinon.stub().resolves();
    const save = createUpsertApplication(client, {
      scheduleFollowUpJob,
      coveredProvinces: COVERED
    });

    const app = await save(makeNormalized({ province: "SANTIAGO" }));

    expect(app.status).to.equal("REJECTED");
    const { update } = upsert.firstCall.args[0];
    expect(update.status).to.equal("REJECTED");
    expect(update.rejectionReason).to.equal(OUT_OF_COVERAGE_AREA);
    expect(update.decidedById).to.equal(null);
    expect(update.decidedAt).to.be.instanceOf(Date);
    expect(update.submittedAt).to.be.instanceOf(Date);
    expect(scheduleFollowUpJob.called).to.equal(false);
  });

  it("never rejects a partial autosave, whatever the province", async () => {
    const { client } = echoClient();
    const save = createUpsertApplication(client, { coveredProvinces: COVERED });

    const app = await save(makeNormalized({ partial: true, province: "SANTIAGO" }));

    expect(app.status).to.equal("DRAFT");
  });

  it("does not reject a final submission with no province", async () => {
    const { client } = echoClient();
    const save = createUpsertApplication(client, { coveredProvinces: COVERED });

    const app = await save(makeNormalized({ province: null }));

    expect(app.status).to.equal("RECEIVED");
  });

  it("does not enforce coverage when built without coveredProvinces (WhatsApp paths)", async () => {
    const { client } = echoClient();
    const save = createUpsertApplication(client);

    const app = await save(makeNormalized({ province: "SANTIAGO" }));

    expect(app.status).to.equal("RECEIVED");
  });
});

describe("createApplicationIntakeHandler", () => {
  afterEach(() => sinon.restore());

  function makeRes() {
    const res: any = {};
    res.status = sinon.stub().returns(res);
    res.json = sinon.stub().returns(res);
    return res;
  }

  function makeReq(body: unknown) {
    return { body, ip: "1.2.3.4", get: () => "test-agent" };
  }

  const finalPayload = (province: string) => ({
    sessionId: "sess-cov",
    partial: false,
    firstName: "Ana",
    lastName: "López",
    phone: "(829) 871-7987",
    province,
    eventId: "evt-1"
  });

  function makeHandler() {
    const { client } = echoClient();
    const scheduleFollowUpJob = sinon.stub().resolves();
    const sendLeadConversion = sinon.stub().resolves(true);
    const handler = createApplicationIntakeHandler({
      upsertApplication: createUpsertApplication(client, {
        scheduleFollowUpJob,
        coveredProvinces: COVERED
      }),
      sendLeadConversion
    });
    return { handler, sendLeadConversion, scheduleFollowUpJob };
  }

  it("answers out_of_area and sends no CAPI Lead for an out-of-area final submit", async () => {
    const { handler, sendLeadConversion, scheduleFollowUpJob } = makeHandler();
    const res = makeRes();

    await handler(makeReq(finalPayload("SANTIAGO")), res);

    expect(res.json.calledOnceWith({ result: "ok", outcome: "out_of_area" })).to.equal(true);
    expect(sendLeadConversion.called).to.equal(false);
    expect(scheduleFollowUpJob.called).to.equal(false);
  });

  it("answers plain ok and sends the CAPI Lead for an in-area final submit", async () => {
    const { handler, sendLeadConversion } = makeHandler();
    const res = makeRes();

    await handler(makeReq(finalPayload("PUERTO_PLATA")), res);

    expect(res.json.calledOnceWith({ result: "ok" })).to.equal(true);
    expect(sendLeadConversion.calledOnce).to.equal(true);
    expect(sendLeadConversion.firstCall.args[0].eventId).to.equal("evt-1");
  });

  it("answers plain ok and sends no Lead for an out-of-area partial autosave", async () => {
    const { handler, sendLeadConversion } = makeHandler();
    const res = makeRes();

    await handler(
      makeReq(
        JSON.stringify({ ...finalPayload("SANTIAGO"), partial: true, lastSection: "vivienda" })
      ),
      res
    );

    expect(res.json.calledOnceWith({ result: "ok" })).to.equal(true);
    expect(sendLeadConversion.called).to.equal(false);
  });

  it("answers ok without persisting a malformed payload", async () => {
    const upsertApplication = sinon.stub();
    const handler = createApplicationIntakeHandler({
      upsertApplication,
      sendLeadConversion: sinon.stub().resolves(true)
    });
    const res = makeRes();

    await handler(makeReq("{not json"), res);

    expect(res.json.calledOnceWith({ result: "ok" })).to.equal(true);
    expect(upsertApplication.called).to.equal(false);
  });
});
