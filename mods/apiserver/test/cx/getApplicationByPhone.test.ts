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
      partial: false
    });
  });

  it("returns null when the phone has no application", async () => {
    const client = { loanApplication: { findFirst: async () => null } } as any;
    expect(await createGetApplicationByPhone(client)("+18095550001")).to.equal(null);
  });
});
