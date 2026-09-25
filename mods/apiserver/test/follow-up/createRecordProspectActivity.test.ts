/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createRecordProspectActivity } from "../../src/follow-up/createRecordProspectActivity.js";

describe("createRecordProspectActivity", () => {
  afterEach(() => sinon.restore());

  it("cancels the pending ABANDON and schedules one abandonDelay from now", async () => {
    const calls: string[] = [];
    const updateMany = sinon.stub().callsFake(async () => {
      calls.push("cancel");
      return { count: 1 };
    });
    const create = sinon.stub().callsFake(async () => {
      calls.push("create");
      return {};
    });
    const client = { followUpJob: { updateMany, create } } as unknown as Parameters<
      typeof createRecordProspectActivity
    >[0];
    const delay = 8 * 60 * 60 * 1000;

    const before = Date.now();
    await createRecordProspectActivity(client, delay)("app-1");

    expect(calls).to.deep.equal(["cancel", "create"]);
    expect(updateMany.firstCall.args[0]).to.deep.equal({
      where: { applicationId: "app-1", status: "PENDING", type: "ABANDON" },
      data: { status: "CANCELLED" }
    });
    const { data } = create.firstCall.args[0];
    expect(data.applicationId).to.equal("app-1");
    expect(data.type).to.equal("ABANDON");
    expect(data.scheduledFor.getTime()).to.be.within(before + delay, Date.now() + delay);
  });
});
