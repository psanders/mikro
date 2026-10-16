/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Marital status is code-only. A stale client posting the old label (a cached
 * site tab, an old desktop build) must never lose a submission or wipe a
 * stored status: the label is dropped and logged.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createApplicationIntakeHandler } from "../../src/api/applications/createApplicationIntakeHandler.js";
import { createUpdateApplication } from "../../src/api/applications/createUpdateApplication.js";
import { logger } from "../../src/logger.js";

const reviewer = { id: "rev-1", roles: ["REVIEWER"] } as any;

describe("marital status input from stale clients", () => {
  afterEach(() => sinon.restore());

  it("intake: a label is stored as null with a warning, and the submission still lands", async () => {
    const warn = sinon.stub(logger, "warn");
    const upsertApplication = sinon.stub().resolves({ id: "app-1", status: "RECEIVED" });
    const handler = createApplicationIntakeHandler({
      upsertApplication,
      sendLeadConversion: sinon.stub().resolves(true)
    } as any);
    const res: any = { json: sinon.stub() };
    res.status = sinon.stub().returns(res);

    await handler(
      {
        body: { sessionId: "s-1", partial: false, firstName: "Ana", maritalStatus: "Casado(a)" },
        ip: "1.2.3.4",
        get: () => "ua"
      } as any,
      res
    );

    expect(upsertApplication.calledOnce).to.be.true;
    expect(upsertApplication.firstCall.args[0].maritalStatus).to.equal(null);
    expect(upsertApplication.firstCall.args[0].firstName).to.equal("Ana");
    expect(res.json.firstCall.args[0]).to.deep.equal({ result: "ok" });
    expect(warn.calledWithMatch("unrecognized maritalStatus dropped")).to.be.true;
  });

  it("intake: a code is stored as is", async () => {
    const upsertApplication = sinon.stub().resolves({ id: "app-1", status: "RECEIVED" });
    const handler = createApplicationIntakeHandler({
      upsertApplication,
      sendLeadConversion: sinon.stub().resolves(true)
    } as any);
    const res: any = { json: sinon.stub() };

    await handler(
      {
        body: { sessionId: "s-1", partial: true, maritalStatus: "CASADO" },
        ip: "",
        get: () => ""
      } as any,
      res
    );

    expect(upsertApplication.firstCall.args[0].maritalStatus).to.equal("CASADO");
  });

  it("reviewer edit: an old-label patch keeps the stored status", async () => {
    const warn = sinon.stub(logger, "warn");
    const app = {
      id: "app-1",
      sessionId: "s-1",
      status: "IN_REVIEW",
      assignedReviewerId: "rev-1",
      maritalStatus: "CASADO",
      rawData: { firstName: "Ana", maritalStatus: "CASADO" }
    };
    const update = sinon.stub().callsFake(async (args: any) => ({ ...app, ...args.data }));
    const client = { loanApplication: { findUnique: sinon.stub().resolves(app), update } } as any;

    await createUpdateApplication(client)(
      { id: "app-1", patch: { maritalStatus: "Soltero(a)", firstName: "Ana María" } } as any,
      reviewer
    );

    const data = update.firstCall.args[0].data;
    expect(data.maritalStatus).to.equal("CASADO");
    expect(data.firstName).to.equal("Ana María");
    expect(warn.calledWithMatch("unrecognized maritalStatus dropped")).to.be.true;
  });
});
