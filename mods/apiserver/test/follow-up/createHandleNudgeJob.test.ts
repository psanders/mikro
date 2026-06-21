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

  it("sends nudge and schedules ABANDON job when RECEIVED + phone", async () => {
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
    expect(create.calledOnce).to.be.true;
    expect(create.firstCall.args[0].data.type).to.equal("ABANDON");
    expect(update.calledOnceWith({ where: { id: "job-1" }, data: { status: "DONE" } })).to.be.true;
  });

  it("schedules immediate ABANDON and does not send when RECEIVED but no phone", async () => {
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
    expect(create.calledOnce).to.be.true;
    const { scheduledFor } = create.firstCall.args[0].data;
    expect(scheduledFor.getTime()).to.be.lessThanOrEqual(Date.now() + 1000);
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

  it("still schedules ABANDON even when nudge send fails", async () => {
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

    expect(create.calledOnce).to.be.true;
    expect(update.calledOnceWith({ where: { id: "job-1" }, data: { status: "DONE" } })).to.be.true;
  });
});
