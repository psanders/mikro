/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Regression test for the double closing message: finalizeApplication must
 * persist the application only and NOT send a WhatsApp message. José's own reply
 * is the single closing message, so the prospect never receives two.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createFinalizeApplication } from "../../src/api/jose/createFinalizeApplication.js";

const CTX = { sessionId: "sess-jose-1", phone: "+18095550000" };

describe("createFinalizeApplication", () => {
  afterEach(() => sinon.restore());

  it("persists the application as complete (partial: false)", async () => {
    const findFirst = sinon.stub().resolves({
      sessionId: CTX.sessionId,
      firstName: "Pedro",
      lastName: "Sanders",
      rawData: {}
    });
    const upsert = sinon.stub().resolves(undefined);
    const tool = createFinalizeApplication({ loanApplication: { findFirst } } as any, upsert);

    const result = await tool({}, CTX);

    expect(result.success).to.be.true;
    expect(result.data!.finalized).to.be.true;
    expect(upsert.calledOnce).to.be.true;
    expect(upsert.firstCall.args[0].partial).to.be.false;
  });

  it("marks the application ABANDONED when outcome is 'abandoned' (no re-upsert)", async () => {
    const findFirst = sinon.stub().resolves({
      id: "app-1",
      sessionId: CTX.sessionId,
      firstName: "Pedro",
      rawData: {}
    });
    const update = sinon.stub().resolves(undefined);
    const upsert = sinon.stub().resolves(undefined);
    const tool = createFinalizeApplication(
      { loanApplication: { findFirst, update } } as any,
      upsert
    );

    const result = await tool({ outcome: "abandoned" }, CTX);

    expect(result.success).to.be.true;
    expect(result.data!.outcome).to.equal("abandoned");
    expect(update.calledOnce).to.be.true;
    expect(update.firstCall.args[0]).to.deep.equal({
      where: { id: "app-1" },
      data: { status: "ABANDONED" }
    });
    // Abandon must NOT run the complete/RECEIVED upsert path.
    expect(upsert.called).to.be.false;
  });

  it("defaults to the complete path when no outcome is given", async () => {
    const findFirst = sinon.stub().resolves({
      id: "app-1",
      sessionId: CTX.sessionId,
      firstName: "Pedro",
      rawData: {}
    });
    const upsert = sinon.stub().resolves(undefined);
    const tool = createFinalizeApplication({ loanApplication: { findFirst } } as any, upsert);

    const result = await tool({}, CTX);

    expect(result.data!.outcome).to.equal("complete");
    expect(upsert.firstCall.args[0].partial).to.be.false;
  });

  it("does not accept a sendWhatsAppMessage dependency (single message source)", () => {
    // The factory takes exactly (client, upsertApplication). A third sender arg
    // would reintroduce the double-message bug.
    expect(createFinalizeApplication.length).to.equal(2);
  });

  it("fails cleanly when the application is missing", async () => {
    const findFirst = sinon.stub().resolves(null);
    const upsert = sinon.stub().resolves(undefined);
    const tool = createFinalizeApplication({ loanApplication: { findFirst } } as any, upsert);

    const result = await tool({}, CTX);

    expect(result.success).to.be.false;
    expect(upsert.called).to.be.false;
  });
});
