/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Deletion snapshots taken before the review-flow change must still restore:
 * their legacy review columns are translated like the migration translated rows.
 */
import { expect } from "chai";
import { snapshotToCreateData, upgradeLegacySnapshot } from "../../src/api/events/helpers.js";

describe("upgradeLegacySnapshot", () => {
  it("leaves a current snapshot alone", () => {
    const snap = { id: "a", status: "IN_REVIEW", assignedReviewerId: "u1" };
    expect(upgradeLegacySnapshot(snap)).to.equal(snap);
  });

  it("moves an IN_REVIEW claim to the assignment columns", () => {
    const out = upgradeLegacySnapshot({
      id: "a",
      status: "IN_REVIEW",
      reviewedById: "u1",
      reviewedAt: "2026-09-01T00:00:00.000Z",
      reviewNote: null
    });
    expect(out).to.include({ assignedReviewerId: "u1", assignedAt: "2026-09-01T00:00:00.000Z" });
    expect(out).to.not.have.any.keys("reviewedById", "reviewedAt", "reviewNote");
  });

  it("turns SIGNED into APPROVED with the requested terms and the decision", () => {
    const out = upgradeLegacySnapshot({
      id: "a",
      status: "SIGNED",
      reviewedById: "admin",
      reviewedAt: "2026-09-02T00:00:00.000Z",
      reviewNote: "ok",
      requestedAmount: 15000,
      requestedTermWeeks: 12
    });
    expect(out).to.include({
      status: "APPROVED",
      decidedById: "admin",
      decisionNote: "ok",
      approvedAmount: 15000,
      approvedTermWeeks: 12
    });
  });

  it("maps an intake out-of-area rejection to its reason, not a note", () => {
    const out = upgradeLegacySnapshot({
      id: "a",
      status: "REJECTED",
      reviewedById: null,
      reviewedAt: null,
      reviewNote: "OUT_OF_COVERAGE_AREA"
    });
    expect(out).to.include({ rejectionReason: "OUT_OF_COVERAGE_AREA", decisionNote: null });
  });

  it("files a human rejection as OTHER keeping its text", () => {
    const out = upgradeLegacySnapshot({
      id: "a",
      status: "REJECTED",
      reviewedById: "admin",
      reviewedAt: "2026-09-05T00:00:00.000Z",
      reviewNote: "no paga"
    });
    expect(out).to.include({
      rejectionReason: "OTHER",
      decisionNote: "no paga",
      decidedById: "admin"
    });
  });

  it("snapshotToCreateData revives the new date columns", () => {
    const data = snapshotToCreateData({
      id: "a",
      status: "IN_REVIEW",
      reviewedById: "u1",
      reviewedAt: "2026-09-01T00:00:00.000Z"
    });
    expect(data.assignedAt).to.be.instanceOf(Date);
  });
});
