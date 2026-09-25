/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Intake writes (website autosaves/beacons, WhatsApp Flow, José) share one
 * upsert. Once a person owns an application it must not be walked back or
 * overwritten by a late intake write (openspec add-application-review-flow).
 */
import { expect } from "chai";
import sinon from "sinon";
import { createUpsertApplication } from "../../src/api/applications/createUpsertApplication.js";
import type { NormalizedApplication } from "@mikro/common";

function normalized(overrides: Partial<NormalizedApplication> = {}): NormalizedApplication {
  return {
    sessionId: "sess-1",
    partial: false,
    lastSection: null,
    rawData: {},
    firstName: "Ana",
    lastName: "López",
    phone: "+18298717987",
    idNumber: null,
    dateOfBirth: null,
    maritalStatus: null,
    businessType: null,
    businessName: null,
    requestedAmount: null,
    purpose: null,
    requestedTermWeeks: null,
    province: null,
    homeAddress: null,
    ...overrides
  };
}

function clientWith(existing: Record<string, unknown> | null) {
  const upsert = sinon.stub().callsFake(async (args: any) => ({
    id: existing?.id ?? "app-new",
    source: "FORM",
    ...(existing ?? {}),
    ...args.update,
    sessionId: args.where.sessionId
  }));
  const client = { loanApplication: { upsert, findFirst: async () => existing } } as any;
  return { client, upsert };
}

describe("createUpsertApplication — status protection", () => {
  afterEach(() => sinon.restore());

  for (const status of ["IN_REVIEW", "PENDING_DECISION", "APPROVED"]) {
    it(`leaves a ${status} application untouched`, async () => {
      const existing = { id: "app-1", sessionId: "sess-1", status };
      const { client, upsert } = clientWith(existing);
      const recordReceived = sinon.stub().resolves();
      const save = createUpsertApplication(client, { recordReceived });

      const result = await save(normalized());

      expect(upsert.called).to.equal(false);
      expect(result).to.equal(existing);
      expect(recordReceived.called).to.equal(false);
    });
  }

  it("never walks a RECEIVED application back to DRAFT on a stray autosave", async () => {
    const submittedAt = new Date("2026-09-20T10:00:00Z");
    const { client, upsert } = clientWith({
      id: "app-1",
      sessionId: "sess-1",
      status: "RECEIVED",
      submittedAt
    });
    const save = createUpsertApplication(client);

    const result = await save(normalized({ partial: true }));

    expect(upsert.firstCall.args[0].update.status).to.equal("RECEIVED");
    expect(upsert.firstCall.args[0].update.submittedAt).to.equal(submittedAt);
    expect(result.status).to.equal("RECEIVED");
  });

  it("updates the data of a RECEIVED application (WhatsApp Flow completion) without a second received event", async () => {
    const { client, upsert } = clientWith({ id: "app-1", sessionId: "sess-1", status: "RECEIVED" });
    const recordReceived = sinon.stub().resolves();
    const save = createUpsertApplication(client, { recordReceived });

    await save(normalized({ businessName: "Colmado Ana" }));

    expect(upsert.firstCall.args[0].update.businessName).to.equal("Colmado Ana");
    expect(recordReceived.called).to.equal(false);
  });

  it("records application.received once, when a DRAFT becomes RECEIVED", async () => {
    const { client } = clientWith({ id: "app-1", sessionId: "sess-1", status: "DRAFT" });
    const recordReceived = sinon.stub().resolves();
    const save = createUpsertApplication(client, { recordReceived });

    await save(normalized());

    expect(recordReceived.calledOnce).to.equal(true);
  });

  it("does not record received for a partial autosave", async () => {
    const { client } = clientWith(null);
    const recordReceived = sinon.stub().resolves();
    await createUpsertApplication(client, { recordReceived })(normalized({ partial: true }));
    expect(recordReceived.called).to.equal(false);
  });

  for (const status of ["CONVERTED", "REJECTED"]) {
    it(`starts a new application instead of overwriting a ${status} one`, async () => {
      const { client, upsert } = clientWith({ id: "app-old", sessionId: "sess-1", status });
      const save = createUpsertApplication(client);

      await save(normalized());

      const args = upsert.firstCall.args[0];
      expect(args.where.sessionId).to.not.equal("sess-1");
      expect(args.where.sessionId.startsWith("sess-1-r")).to.equal(true);
      expect(args.create.sessionId).to.equal(args.where.sessionId);
    });
  }

  it("lets an ABANDONED draft come back when the prospect returns", async () => {
    const { client, upsert } = clientWith({
      id: "app-1",
      sessionId: "sess-1",
      status: "ABANDONED"
    });
    await createUpsertApplication(client)(normalized({ partial: true }));
    expect(upsert.firstCall.args[0].where.sessionId).to.equal("sess-1");
    expect(upsert.firstCall.args[0].update.status).to.equal("DRAFT");
  });
});
