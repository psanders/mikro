/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The post-rejection hook (rejection SMS) fires once after a committed reject,
 * and never on a blocked reject.
 */
import { expect } from "chai";
import sinon from "sinon";
import type { DbClient, LoanApplication, TransitionActor } from "@mikro/common";
import { createRejectApplication } from "../../src/api/applications/reviewApplication.js";

const REVIEWER: TransitionActor = { id: "rev1", roles: ["REVIEWER"] };

function fakeDb(status: LoanApplication["status"]) {
  const app = {
    id: "app1",
    status,
    assignedReviewerId: "rev1",
    phone: "+18095551234",
    reviewerRecommendation: null,
    contractFilename: null,
    approvedAmount: null,
    contractTerms: null
  } as unknown as LoanApplication;
  const row = { ...app };
  const client = {
    loanApplication: {
      findUnique: sinon.stub().callsFake(async () => ({ ...row })),
      updateMany: sinon.stub().callsFake(async ({ data }: { data: object }) => {
        Object.assign(row, data);
        return { count: 1 };
      })
    }
  } as unknown as DbClient;
  return client;
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("createRejectApplication — onRejected hook", () => {
  it("calls onRejected once with the rejected application", async () => {
    const onRejected = sinon.stub().resolves();
    const r = await createRejectApplication(fakeDb("IN_REVIEW"), { onRejected })(
      { id: "app1", reason: "PAYMENT_CAPACITY" },
      REVIEWER
    );
    expect(r.status).to.equal("REJECTED");
    expect(onRejected.calledOnce).to.equal(true);
    expect(onRejected.firstCall.args[0]).to.include({ id: "app1", status: "REJECTED" });
  });

  it("does not fail the reject when the hook fails", async () => {
    const onRejected = sinon.stub().rejects(new Error("twilio down"));
    const r = await createRejectApplication(fakeDb("IN_REVIEW"), { onRejected })(
      { id: "app1", reason: "PAYMENT_CAPACITY" },
      REVIEWER
    );
    await flush();
    expect(r.status).to.equal("REJECTED");
  });

  it("does not call onRejected when the reject is blocked", async () => {
    const onRejected = sinon.stub().resolves();
    let threw = false;
    try {
      await createRejectApplication(fakeDb("APPROVED"), { onRejected })(
        { id: "app1", reason: "PAYMENT_CAPACITY" },
        REVIEWER
      );
    } catch {
      threw = true;
    }
    expect(threw).to.equal(true);
    expect(onRejected.called).to.equal(false);
  });
});
