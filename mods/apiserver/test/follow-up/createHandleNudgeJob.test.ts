/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createHandleNudgeJob } from "../../src/follow-up/createHandleNudgeJob.js";
import type { FollowUpJob } from "@mikro/common";

function makeJob(overrides: Partial<FollowUpJob> = {}): FollowUpJob {
  return {
    id: "job-1",
    applicationId: "app-1",
    type: "NUDGE",
    scheduledFor: new Date(),
    status: "PENDING",
    createdAt: new Date(),
    ...overrides
  };
}

function makeApp(overrides: Record<string, unknown> = {}) {
  return {
    id: "app-1",
    status: "RECEIVED",
    phone: "+18298717987",
    ...overrides
  };
}

describe("createHandleNudgeJob", () => {
  afterEach(() => sinon.restore());

  it("sends the nudge and schedules no ABANDON when RECEIVED + phone", async () => {
    const findUnique = sinon.stub().resolves(makeApp());
    const create = sinon.stub().resolves({});
    const update = sinon.stub().resolves({});
    const client = {
      loanApplication: { findUnique },
      followUpJob: { create, update }
    } as unknown as Parameters<typeof createHandleNudgeJob>[0]["client"];

    const sendFollowUpNudge = sinon.stub().resolves({ sent: true, messageId: "mid-1" });
    const handler = createHandleNudgeJob({ client, sendFollowUpNudge });

    await handler(makeJob());

    expect(sendFollowUpNudge.calledOnceWith("+18298717987")).to.be.true;
    // A submitted application is never abandoned by a timer.
    expect(create.called).to.be.false;
    expect(update.calledOnceWith({ where: { id: "job-1" }, data: { status: "DONE" } })).to.be.true;
  });

  it("does not send and schedules nothing when RECEIVED but no phone", async () => {
    const findUnique = sinon.stub().resolves(makeApp({ phone: null }));
    const create = sinon.stub().resolves({});
    const update = sinon.stub().resolves({});
    const client = {
      loanApplication: { findUnique },
      followUpJob: { create, update }
    } as unknown as Parameters<typeof createHandleNudgeJob>[0]["client"];

    const sendFollowUpNudge = sinon.stub().resolves({ sent: false });
    const handler = createHandleNudgeJob({ client, sendFollowUpNudge });

    await handler(makeJob());

    expect(sendFollowUpNudge.called).to.be.false;
    expect(create.called).to.be.false;
    expect(update.calledOnceWith({ where: { id: "job-1" }, data: { status: "DONE" } })).to.be.true;
  });

  it("cancels job when application is not RECEIVED", async () => {
    const findUnique = sinon.stub().resolves(makeApp({ status: "IN_REVIEW" }));
    const create = sinon.stub().resolves({});
    const update = sinon.stub().resolves({});
    const client = {
      loanApplication: { findUnique },
      followUpJob: { create, update }
    } as unknown as Parameters<typeof createHandleNudgeJob>[0]["client"];

    const sendFollowUpNudge = sinon.stub().resolves({ sent: false });
    const handler = createHandleNudgeJob({ client, sendFollowUpNudge });

    await handler(makeJob());

    expect(sendFollowUpNudge.called).to.be.false;
    expect(create.called).to.be.false;
    expect(update.calledOnceWith({ where: { id: "job-1" }, data: { status: "CANCELLED" } })).to.be
      .true;
  });

  it("cancels job when application is not found", async () => {
    const findUnique = sinon.stub().resolves(null);
    const update = sinon.stub().resolves({});
    const client = {
      loanApplication: { findUnique },
      followUpJob: { update }
    } as unknown as Parameters<typeof createHandleNudgeJob>[0]["client"];

    const sendFollowUpNudge = sinon.stub();
    const handler = createHandleNudgeJob({ client, sendFollowUpNudge });

    await handler(makeJob());

    expect(update.calledOnceWith({ where: { id: "job-1" }, data: { status: "CANCELLED" } })).to.be
      .true;
  });

  it("marks the job DONE even when the nudge send fails", async () => {
    const findUnique = sinon.stub().resolves(makeApp());
    const create = sinon.stub().resolves({});
    const update = sinon.stub().resolves({});
    const client = {
      loanApplication: { findUnique },
      followUpJob: { create, update }
    } as unknown as Parameters<typeof createHandleNudgeJob>[0]["client"];

    const sendFollowUpNudge = sinon.stub().resolves({ sent: false, error: "API error" });
    const handler = createHandleNudgeJob({ client, sendFollowUpNudge });

    await handler(makeJob());

    expect(create.called).to.be.false;
    expect(update.calledOnceWith({ where: { id: "job-1" }, data: { status: "DONE" } })).to.be.true;
  });
});
