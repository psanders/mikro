/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createReopenApplication } from "../../src/follow-up/createReopenApplication.js";

function setup(app: Record<string, unknown> | null) {
  const update = sinon.stub().resolves({});
  const client = {
    loanApplication: { findUnique: sinon.stub().resolves(app), update }
  } as unknown as Parameters<typeof createReopenApplication>[0];
  const recordActivity = sinon.stub().resolves();
  return { reopen: createReopenApplication(client, recordActivity), update, recordActivity };
}

describe("createReopenApplication", () => {
  afterEach(() => sinon.restore());

  it("reopens a never-submitted ABANDONED application to DRAFT and restarts its clock", async () => {
    const { reopen, update, recordActivity } = setup({
      id: "app-1",
      status: "ABANDONED",
      submittedAt: null
    });

    expect(await reopen("app-1")).to.be.true;
    expect(update.calledOnceWith({ where: { id: "app-1" }, data: { status: "DRAFT" } })).to.be.true;
    expect(recordActivity.calledOnceWith("app-1")).to.be.true;
  });

  it("does not reopen an application withdrawn after submission", async () => {
    const { reopen, update, recordActivity } = setup({
      id: "app-1",
      status: "ABANDONED",
      submittedAt: new Date()
    });

    expect(await reopen("app-1")).to.be.false;
    expect(update.called).to.be.false;
    expect(recordActivity.called).to.be.false;
  });

  it("does not touch an application that is not ABANDONED", async () => {
    const { reopen, update } = setup({ id: "app-1", status: "REJECTED", submittedAt: null });
    expect(await reopen("app-1")).to.be.false;
    expect(update.called).to.be.false;
  });
});
