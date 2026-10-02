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
      status: "DRAFT",
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
      status: "DRAFT",
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
      status: "DRAFT",
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

  // openspec jose-keep-gathering: José keeps asking after submission; finalizing
  // then only ends his questions.
  for (const outcome of ["complete", "abandoned"]) {
    it(`on a submitted application, '${outcome}' only closes intake (never abandons or re-submits)`, async () => {
      const findFirst = sinon.stub().resolves({
        id: "app-9",
        sessionId: CTX.sessionId,
        status: "RECEIVED",
        intakeClosedAt: null,
        rawData: {}
      });
      const update = sinon.stub().resolves(undefined);
      const upsert = sinon.stub().resolves(undefined);
      const tool = createFinalizeApplication(
        { loanApplication: { findFirst, update } } as any,
        upsert
      );

      const result = await tool({ outcome }, CTX);

      expect(result.success).to.be.true;
      expect(result.data!.outcome).to.equal("intake_closed");
      expect(upsert.called).to.be.false;
      expect(update.calledOnce).to.be.true;
      expect(update.firstCall.args[0].where).to.deep.equal({ id: "app-9" });
      expect(update.firstCall.args[0].data).to.have.keys(["intakeClosedAt"]);
    });
  }
  it("tells José which fields are still missing after submitting", async () => {
    const findFirst = sinon.stub().resolves({
      id: "app-1",
      sessionId: CTX.sessionId,
      status: "DRAFT",
      firstName: "Luis",
      rawData: {}
    });
    const tool = createFinalizeApplication(
      { loanApplication: { findFirst } } as any,
      sinon.stub().resolves(undefined)
    );

    const result = await tool({}, CTX);

    expect(result.data!.missingFields).to.be.an("array").that.includes("province");
  });

  describe("outside the covered area", () => {
    let coverage: { coveredProvinces: string[]; recordOutOfArea: sinon.SinonStub };
    beforeEach(() => {
      coverage = { coveredProvinces: ["Puerto Plata"], recordOutOfArea: sinon.stub().resolves() };
    });

    for (const status of ["DRAFT", "RECEIVED"]) {
      it(`rejects a ${status} application as a system decision, never queuing it`, async () => {
        const app = {
          id: "app-1",
          sessionId: CTX.sessionId,
          status,
          province: "Santiago",
          intakeClosedAt: null,
          submittedAt: null,
          rawData: {}
        };
        const update = sinon.stub().callsFake(async ({ data }) => ({ ...app, ...data }));
        const upsert = sinon.stub().resolves(undefined);
        const tool = createFinalizeApplication(
          { loanApplication: { findFirst: sinon.stub().resolves(app), update } } as any,
          upsert,
          coverage
        );

        const result = await tool({ outcome: "complete" }, CTX);

        expect(result.data!.outcome).to.equal("out_of_zone");
        expect(upsert.called).to.be.false;
        expect(update.firstCall.args[0].data).to.include({
          status: "REJECTED",
          decidedById: null,
          rejectionReason: "OUT_OF_COVERAGE_AREA"
        });
        expect(coverage.recordOutOfArea.calledOnce).to.be.true;
      });
    }

    it("submits a covered province as before", async () => {
      const findFirst = sinon.stub().resolves({
        id: "app-1",
        sessionId: CTX.sessionId,
        status: "DRAFT",
        province: "puerto plata",
        rawData: {}
      });
      const upsert = sinon.stub().resolves(undefined);
      const tool = createFinalizeApplication(
        { loanApplication: { findFirst } } as any,
        upsert,
        coverage
      );

      const result = await tool({}, CTX);

      expect(result.data!.outcome).to.equal("complete");
      expect(upsert.calledOnce).to.be.true;
    });

    it("leaves an application a reviewer already took alone", async () => {
      const update = sinon.stub().resolves(undefined);
      const tool = createFinalizeApplication(
        {
          loanApplication: {
            findFirst: sinon.stub().resolves({
              id: "app-1",
              sessionId: CTX.sessionId,
              status: "IN_REVIEW",
              province: "Santiago",
              intakeClosedAt: null,
              rawData: {}
            }),
            update
          }
        } as any,
        sinon.stub(),
        coverage
      );

      const result = await tool({}, CTX);

      expect(result.data!.outcome).to.equal("intake_closed");
      expect(update.firstCall.args[0].data).to.have.keys(["intakeClosedAt"]);
    });
  });
});
