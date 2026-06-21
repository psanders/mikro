/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createCancelApplicationJobs } from "../../src/follow-up/createCancelApplicationJobs.js";

describe("createCancelApplicationJobs", () => {
  afterEach(() => sinon.restore());

  it("sets all PENDING jobs for the application to CANCELLED", async () => {
    const updateMany = sinon.stub().resolves({ count: 2 });
    const client = { followUpJob: { updateMany } } as unknown as Parameters<
      typeof createCancelApplicationJobs
    >[0];

    const cancel = createCancelApplicationJobs(client);
    await cancel("app-1");

    expect(updateMany.calledOnce).to.be.true;
    expect(updateMany.firstCall.args[0]).to.deep.equal({
      where: { applicationId: "app-1", status: "PENDING" },
      data: { status: "CANCELLED" }
    });
  });

  it("does not throw when no PENDING jobs exist", async () => {
    const updateMany = sinon.stub().resolves({ count: 0 });
    const client = { followUpJob: { updateMany } } as unknown as Parameters<
      typeof createCancelApplicationJobs
    >[0];

    const cancel = createCancelApplicationJobs(client);
    let threw = false;
    try {
      await cancel("app-1");
    } catch {
      threw = true;
    }
    expect(threw).to.be.false;
  });
});
