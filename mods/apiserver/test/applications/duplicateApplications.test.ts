/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * One application per person (issue #302): the same person — matched by phone
 * OR cédula — gets no second application while one is in process, none within
 * 30 days of a rejection (any reason, out of coverage area included), and an
 * older unsubmitted DRAFT takes the new answers. Checked on the website's
 * final submit, the WhatsApp Flow and José's finalize.
 */
import { expect } from "chai";
import sinon from "sinon";
import {
  createFindPriorApplication,
  REAPPLY_COOLDOWN_DAYS
} from "../../src/api/applications/createFindPriorApplication.js";
import { createApplicationIntakeHandler } from "../../src/api/applications/createApplicationIntakeHandler.js";
import { createSubmitApplicationFromFlow } from "../../src/api/applications/createSubmitApplicationFromFlow.js";
import { createFinalizeApplication } from "../../src/api/jose/createFinalizeApplication.js";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-16T12:00:00Z");
const PHONE = "+18298717987";
const CEDULA = "037-0105842-6";

type Row = {
  id: string;
  sessionId: string;
  status: string;
  phone?: string | null;
  idNumber?: string | null;
  decidedAt?: Date | null;
  submittedAt?: Date | null;
  updatedAt?: Date;
  rejectionReason?: string | null;
  createdAt?: Date;
};

/** A client whose findMany applies the OR of phone / idNumber / sessionId filters. */
function clientWith(rows: Row[]) {
  const findMany = sinon.stub().callsFake(async (args: { where: { OR: object[] } }) => {
    const matches = (row: Row) =>
      args.where.OR.some((cond) =>
        Object.entries(cond).every(
          ([key, value]) => (row as Record<string, unknown>)[key] === value
        )
      );
    return rows.filter(matches).map((r) => ({
      updatedAt: r.decidedAt ?? NOW,
      decidedAt: null,
      submittedAt: null,
      rejectionReason: null,
      ...r
    }));
  });
  return { loanApplication: { findMany } } as any;
}

describe("createFindPriorApplication (issue #302)", () => {
  const find = (
    rows: Row[],
    query: Partial<Parameters<ReturnType<typeof createFindPriorApplication>>[0]> = {}
  ) =>
    createFindPriorApplication(clientWith(rows))({
      phone: PHONE,
      idNumber: null,
      sessionId: "sess-new",
      now: NOW,
      ...query
    });

  it("blocks a person rejected less than 30 days ago, by phone", async () => {
    const decidedAt = new Date(NOW.getTime() - 5 * DAY);
    const prior = await find([
      {
        id: "a1",
        sessionId: "s1",
        status: "REJECTED",
        phone: PHONE,
        decidedAt,
        rejectionReason: "OTHER"
      }
    ]);
    expect(prior).to.deep.include({ kind: "cooldown", applicationId: "a1" });
    expect((prior as { reapplyFrom: Date }).reapplyFrom.getTime()).to.equal(
      decidedAt.getTime() + REAPPLY_COOLDOWN_DAYS * DAY
    );
  });

  it("matches by cédula when they apply with another phone, whatever the format", async () => {
    const decidedAt = new Date(NOW.getTime() - 2 * DAY);
    const rows = [
      {
        id: "a1",
        sessionId: "s1",
        status: "REJECTED",
        phone: "+18495550000",
        idNumber: CEDULA,
        decidedAt
      }
    ];
    expect((await find(rows, { idNumber: "03701058426" }))?.kind).to.equal("cooldown");
    expect((await find(rows, { idNumber: CEDULA }))?.kind).to.equal("cooldown");
  });

  it("blocks an out-of-coverage-area rejection too", async () => {
    const prior = await find([
      {
        id: "a1",
        sessionId: "s1",
        status: "REJECTED",
        phone: PHONE,
        decidedAt: new Date(NOW.getTime() - 1 * DAY),
        rejectionReason: "OUT_OF_COVERAGE_AREA"
      }
    ]);
    expect(prior).to.deep.include({ kind: "cooldown", rejectionReason: "OUT_OF_COVERAGE_AREA" });
  });

  it("allows applying again once the 30 days are over", async () => {
    const prior = await find([
      {
        id: "a1",
        sessionId: "s1",
        status: "REJECTED",
        phone: PHONE,
        decidedAt: new Date(NOW.getTime() - 31 * DAY)
      }
    ]);
    expect(prior).to.be.null;
  });

  it("counts a rejection under the session being submitted", async () => {
    const prior = await find([
      {
        id: "a1",
        sessionId: "sess-new",
        status: "REJECTED",
        phone: PHONE,
        decidedAt: new Date(NOW.getTime() - DAY)
      }
    ]);
    expect(prior?.kind).to.equal("cooldown");
  });

  it("reports an application in process, ahead of a cooldown", async () => {
    const prior = await find([
      {
        id: "a1",
        sessionId: "s1",
        status: "REJECTED",
        phone: PHONE,
        decidedAt: new Date(NOW.getTime() - DAY)
      },
      { id: "a2", sessionId: "s2", status: "IN_REVIEW", phone: PHONE }
    ]);
    expect(prior).to.deep.equal({
      kind: "in_process",
      applicationId: "a2",
      sessionId: "s2",
      status: "IN_REVIEW"
    });
  });

  it("never treats the submitted session itself as in process (a repeated submit)", async () => {
    const prior = await find([
      { id: "a1", sessionId: "sess-new", status: "RECEIVED", phone: PHONE }
    ]);
    expect(prior).to.be.null;
  });

  it("finds an older unsubmitted draft under another session", async () => {
    const prior = await find([{ id: "a1", sessionId: "s-old", status: "DRAFT", phone: PHONE }]);
    expect(prior).to.deep.equal({ kind: "draft", applicationId: "a1", sessionId: "s-old" });
  });

  it("returns null with no phone and no cédula", async () => {
    expect(await find([], { phone: null, idNumber: null })).to.be.null;
  });
});

describe("website intake: one application per person (issue #302)", () => {
  afterEach(() => sinon.restore());

  const res = () => {
    const r: any = {};
    r.status = sinon.stub().returns(r);
    r.json = sinon.stub().returns(r);
    return r;
  };
  const req = (body: unknown) => ({ body, ip: "1.2.3.4", get: () => "ua" });
  const submit = (partial = false) => ({
    sessionId: "sess-new",
    partial,
    firstName: "Ana",
    phone: "(829) 871-7987",
    idNumber: CEDULA,
    province: "PUERTO_PLATA"
  });

  function handler(prior: unknown) {
    const upsertApplication = sinon.stub().resolves({ status: "RECEIVED", rejectionReason: null });
    const sendLeadConversion = sinon.stub().resolves(true);
    const findPriorApplication = sinon.stub().resolves(prior);
    const discardDraft = sinon.stub().resolves();
    const handle = createApplicationIntakeHandler({
      upsertApplication,
      sendLeadConversion,
      findPriorApplication,
      discardDraft
    });
    return { handle, upsertApplication, sendLeadConversion, findPriorApplication, discardDraft };
  }

  it("creates nothing for a recently rejected person and answers with the date", async () => {
    const reapplyFrom = new Date("2026-11-08T15:00:00Z");
    const h = handler({
      kind: "cooldown",
      applicationId: "a1",
      reapplyFrom,
      rejectionReason: "OTHER"
    });
    const r = res();

    await h.handle(req(submit()), r);

    expect(h.findPriorApplication.firstCall.args[0]).to.include({
      phone: PHONE,
      idNumber: CEDULA,
      sessionId: "sess-new"
    });
    expect(h.upsertApplication.called).to.be.false;
    expect(h.sendLeadConversion.called).to.be.false;
    expect(r.json.firstCall.args[0]).to.deep.equal({
      result: "ok",
      outcome: "cooldown",
      reapplyFrom: reapplyFrom.toISOString()
    });
  });

  it("flags an out-of-area cooldown so the site words it right", async () => {
    const h = handler({
      kind: "cooldown",
      applicationId: "a1",
      reapplyFrom: new Date("2026-11-08T15:00:00Z"),
      rejectionReason: "OUT_OF_COVERAGE_AREA"
    });
    const r = res();
    await h.handle(req(submit()), r);
    expect(r.json.firstCall.args[0]).to.include({ outcome: "cooldown", outOfArea: true });
  });

  it("creates nothing while another application is in process", async () => {
    const h = handler({
      kind: "in_process",
      applicationId: "a2",
      sessionId: "s2",
      status: "RECEIVED"
    });
    const r = res();

    await h.handle(req(submit()), r);

    expect(h.upsertApplication.called).to.be.false;
    expect(r.json.firstCall.args[0]).to.deep.equal({ result: "ok", outcome: "in_process" });
  });

  it("puts the answers into the person's older draft and discards this session's", async () => {
    const h = handler({ kind: "draft", applicationId: "a3", sessionId: "s-old" });
    const r = res();

    await h.handle(req(submit()), r);

    expect(h.upsertApplication.firstCall.args[0].sessionId).to.equal("s-old");
    expect(h.discardDraft.calledOnceWith("sess-new")).to.be.true;
    expect(r.json.firstCall.args[0]).to.deep.equal({ result: "ok" });
  });

  it("never checks an autosave", async () => {
    const h = handler({ kind: "cooldown", applicationId: "a1", reapplyFrom: new Date() });
    await h.handle(req(submit(true)), res());
    expect(h.findPriorApplication.called).to.be.false;
    expect(h.upsertApplication.calledOnce).to.be.true;
  });
});

describe("WhatsApp Flow: one application per person (issue #302)", () => {
  const payload = { sessionId: "wa-1", partial: false, phone: "8298717987", firstName: "María" };

  it("returns the cooldown instead of submitting", async () => {
    const upsertApplication = sinon.stub().resolves({});
    const reapplyFrom = new Date("2026-11-08T15:00:00Z");
    const submit = createSubmitApplicationFromFlow({
      upsertApplication,
      findLatestApplicationByPhone: sinon.stub().resolves(null),
      findPriorApplication: sinon.stub().resolves({
        kind: "cooldown",
        applicationId: "a1",
        reapplyFrom,
        rejectionReason: "OUT_OF_COVERAGE_AREA"
      })
    });

    expect(await submit(payload)).to.deep.equal({
      outcome: "cooldown",
      reapplyFrom,
      outOfArea: true
    });
    expect(upsertApplication.called).to.be.false;
  });

  it("returns in_process instead of submitting a second application", async () => {
    const upsertApplication = sinon.stub().resolves({});
    const submit = createSubmitApplicationFromFlow({
      upsertApplication,
      findLatestApplicationByPhone: sinon.stub().resolves(null),
      findPriorApplication: sinon
        .stub()
        .resolves({ kind: "in_process", applicationId: "a2", sessionId: "s2", status: "IN_REVIEW" })
    });

    expect(await submit(payload)).to.deep.equal({ outcome: "in_process" });
    expect(upsertApplication.called).to.be.false;
  });

  it("submits otherwise", async () => {
    const upsertApplication = sinon.stub().resolves({});
    const submit = createSubmitApplicationFromFlow({
      upsertApplication,
      findLatestApplicationByPhone: sinon.stub().resolves(null),
      findPriorApplication: sinon.stub().resolves(null)
    });

    expect(await submit(payload)).to.deep.equal({ outcome: "received" });
    expect(upsertApplication.calledOnce).to.be.true;
  });
});

describe("José finalize: one application per person (issue #302)", () => {
  afterEach(() => sinon.restore());
  const CTX = { sessionId: "sess-jose", phone: PHONE };

  function tool(prior: unknown) {
    const findFirst = sinon.stub().resolves({
      id: "app-j",
      sessionId: CTX.sessionId,
      status: "DRAFT",
      phone: PHONE,
      idNumber: CEDULA,
      rawData: {}
    });
    const update = sinon.stub().resolves({});
    const updateMany = sinon.stub().resolves({ count: 0 });
    const upsert = sinon.stub().resolves(undefined);
    const findPriorApplication = sinon.stub().resolves(prior);
    const finalize = createFinalizeApplication(
      { loanApplication: { findFirst, update }, followUpJob: { updateMany } } as any,
      upsert,
      { findPriorApplication }
    );
    return { finalize, update, upsert, findPriorApplication };
  }

  it("doesn't submit for a recently rejected person; gives José the date", async () => {
    const t = tool({
      kind: "cooldown",
      applicationId: "a1",
      reapplyFrom: new Date("2026-10-26T12:00:00Z"),
      rejectionReason: "OTHER"
    });

    const result = await t.finalize({ outcome: "complete" }, CTX);

    expect(t.upsert.called).to.be.false;
    expect(t.update.firstCall.args[0].data).to.deep.equal({ status: "ABANDONED" });
    expect(result.data).to.deep.equal({
      finalized: false,
      outcome: "cooldown",
      reapplyDate: "26 de octubre de 2026"
    });
  });

  it("doesn't submit a second application while one is in process", async () => {
    const t = tool({
      kind: "in_process",
      applicationId: "a2",
      sessionId: "s2",
      status: "RECEIVED"
    });

    const result = await t.finalize({ outcome: "complete" }, CTX);

    expect(t.upsert.called).to.be.false;
    expect(result.data).to.deep.include({ finalized: false, outcome: "in_process" });
  });

  it("submits as before when the person has no other application", async () => {
    const t = tool(null);
    const result = await t.finalize({ outcome: "complete" }, CTX);
    expect(t.upsert.calledOnce).to.be.true;
    expect(result.data!.finalized).to.be.true;
  });
});
