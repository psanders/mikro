/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { createGetApplicationByPhone } from "../../src/api/applications/createGetApplicationByPhone.js";

describe("createGetApplicationByPhone", () => {
  it("returns id, session, status and submittedAt of the latest application", async () => {
    const submittedAt = new Date("2026-09-20T10:00:00Z");
    const client = {
      loanApplication: {
        findFirst: async () => ({
          id: "app-1",
          sessionId: "s-1",
          status: "IN_REVIEW",
          submittedAt
        })
      }
    } as any;

    const result = await createGetApplicationByPhone(client)("+18095550001");

    expect(result).to.deep.equal({
      applicationId: "app-1",
      sessionId: "s-1",
      status: "IN_REVIEW",
      submittedAt,
      decidedAt: null,
      partial: false,
      intakeOpen: false
    });
  });

  it("asks isIntakeOpen only for a RECEIVED application", async () => {
    const calls: string[] = [];
    const isIntakeOpen = async (app: { id: string }) => {
      calls.push(app.id);
      return true;
    };
    const received = {
      loanApplication: {
        findFirst: async () => ({
          id: "app-2",
          sessionId: "s-2",
          status: "RECEIVED",
          submittedAt: new Date()
        })
      }
    } as any;
    const inReview = {
      loanApplication: {
        findFirst: async () => ({
          id: "app-3",
          sessionId: "s-3",
          status: "IN_REVIEW",
          submittedAt: new Date()
        })
      }
    } as any;

    expect((await createGetApplicationByPhone(received, { isIntakeOpen })("+1"))!.intakeOpen).to.be
      .true;
    expect((await createGetApplicationByPhone(inReview, { isIntakeOpen })("+1"))!.intakeOpen).to.be
      .false;
    expect(calls).to.deep.equal(["app-2"]);
  });

  it("returns null when the phone has no application", async () => {
    const client = { loanApplication: { findFirst: async () => null } } as any;
    expect(await createGetApplicationByPhone(client)("+18095550001")).to.equal(null);
  });
});
