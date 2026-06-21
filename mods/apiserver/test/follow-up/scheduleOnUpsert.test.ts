/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Verifies that a NUDGE job is scheduled when an external application is
 * upserted as RECEIVED, and that manual applications do NOT schedule a job.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createUpsertApplication } from "../../src/api/applications/createUpsertApplication.js";
import type { NormalizedApplication } from "@mikro/common";

function makeNormalized(overrides: Partial<NormalizedApplication> = {}): NormalizedApplication {
  return {
    sessionId: "sess-1",
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

describe("createUpsertApplication — follow-up scheduling", () => {
  afterEach(() => sinon.restore());

  it("schedules a NUDGE job for a FORM submission reaching RECEIVED", async () => {
    const app = { id: "app-1", status: "RECEIVED" };
    const upsertStub = sinon.stub().resolves(app);
    const client = {
      loanApplication: { upsert: upsertStub }
    } as any;

    const scheduleFollowUpJob = sinon.stub().resolves();
    const upsert = createUpsertApplication(client, { scheduleFollowUpJob });

    await upsert(makeNormalized());

    expect(scheduleFollowUpJob.calledOnceWith("app-1")).to.be.true;
  });

  it("schedules a NUDGE job for a WHATSAPP submission", async () => {
    const app = { id: "app-2", status: "RECEIVED" };
    const upsertStub = sinon.stub().resolves(app);
    const client = { loanApplication: { upsert: upsertStub } } as any;

    const scheduleFollowUpJob = sinon.stub().resolves();
    const upsert = createUpsertApplication(client, { scheduleFollowUpJob });

    await upsert({ ...makeNormalized({ sessionId: "sess-2" }), source: "WHATSAPP" } as any);

    expect(scheduleFollowUpJob.calledOnceWith("app-2")).to.be.true;
  });

  it("does NOT schedule a job for a partial (DRAFT) submission", async () => {
    const app = { id: "app-3", status: "DRAFT" };
    const upsertStub = sinon.stub().resolves(app);
    const client = { loanApplication: { upsert: upsertStub } } as any;

    const scheduleFollowUpJob = sinon.stub().resolves();
    const upsert = createUpsertApplication(client, { scheduleFollowUpJob });

    await upsert(makeNormalized({ partial: true }));

    expect(scheduleFollowUpJob.called).to.be.false;
  });

  it("does NOT schedule a job for MANUAL source", async () => {
    const app = { id: "app-4", status: "RECEIVED" };
    const upsertStub = sinon.stub().resolves(app);
    const client = { loanApplication: { upsert: upsertStub } } as any;

    const scheduleFollowUpJob = sinon.stub().resolves();
    const upsert = createUpsertApplication(client, { scheduleFollowUpJob });

    await upsert({ ...makeNormalized({ sessionId: "sess-4" }), source: "MANUAL" } as any);

    expect(scheduleFollowUpJob.called).to.be.false;
  });
});
