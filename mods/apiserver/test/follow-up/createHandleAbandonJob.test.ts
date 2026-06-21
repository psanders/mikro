/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createHandleAbandonJob } from "../../src/follow-up/createHandleAbandonJob.js";
import type { FollowUpJob } from "@mikro/common";

function makeJob(overrides: Partial<FollowUpJob> = {}): FollowUpJob {
  return {
    id: "job-2",
    applicationId: "app-1",
    type: "ABANDON",
    scheduledFor: new Date(),
    status: "PENDING",
    createdAt: new Date(),
    ...overrides
  };
}

describe("createHandleAbandonJob", () => {
  afterEach(() => sinon.restore());

  it("marks application ABANDONED and job DONE when status is RECEIVED", async () => {
    const appUpdate = sinon.stub().resolves({});
    const jobUpdate = sinon.stub().resolves({});
    const findUnique = sinon.stub().resolves({ id: "app-1", status: "RECEIVED" });
    const client = {
      loanApplication: { findUnique, update: appUpdate },
      followUpJob: { update: jobUpdate }
    } as unknown as Parameters<typeof createHandleAbandonJob>[0];

    const handler = createHandleAbandonJob(client);
    await handler(makeJob());

    expect(appUpdate.calledOnceWith({ where: { id: "app-1" }, data: { status: "ABANDONED" } })).to
      .be.true;
    expect(jobUpdate.calledOnceWith({ where: { id: "job-2" }, data: { status: "DONE" } })).to.be
      .true;
  });

  it("cancels job without touching application when already past RECEIVED", async () => {
    const appUpdate = sinon.stub().resolves({});
    const jobUpdate = sinon.stub().resolves({});
    const findUnique = sinon.stub().resolves({ id: "app-1", status: "IN_REVIEW" });
    const client = {
      loanApplication: { findUnique, update: appUpdate },
      followUpJob: { update: jobUpdate }
    } as unknown as Parameters<typeof createHandleAbandonJob>[0];

    const handler = createHandleAbandonJob(client);
    await handler(makeJob());

    expect(appUpdate.called).to.be.false;
    expect(jobUpdate.calledOnceWith({ where: { id: "job-2" }, data: { status: "CANCELLED" } })).to
      .be.true;
  });

  it("cancels job when application is not found", async () => {
    const jobUpdate = sinon.stub().resolves({});
    const findUnique = sinon.stub().resolves(null);
    const client = {
      loanApplication: { findUnique, update: sinon.stub() },
      followUpJob: { update: jobUpdate }
    } as unknown as Parameters<typeof createHandleAbandonJob>[0];

    const handler = createHandleAbandonJob(client);
    await handler(makeJob());

    expect(jobUpdate.calledOnceWith({ where: { id: "job-2" }, data: { status: "CANCELLED" } })).to
      .be.true;
  });
});
