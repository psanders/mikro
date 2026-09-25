/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { applicationStatusEnum } from "../../src/schemas/application.js";
import {
  REVIEW_ACTIONS,
  evaluateTransition,
  evidenceStatus,
  transitionBlockCode,
  type ApplicationForTransition,
  type EvidenceStatus,
  type ReviewAction,
  type TransitionActor,
  type TransitionInput
} from "../../src/schemas/applicationReview.js";

type Status = (typeof applicationStatusEnum.options)[number];

const ADMIN: TransitionActor = { id: "admin-1", roles: ["ADMIN"] };
const REVIEWER: TransitionActor = { id: "rev-1", roles: ["REVIEWER"] };
const OTHER_REVIEWER: TransitionActor = { id: "rev-2", roles: ["REVIEWER"] };
const FOUNDER: TransitionActor = { id: "founder", roles: ["ADMIN", "REVIEWER", "COLLECTOR"] };
const COLLECTOR: TransitionActor = { id: "col-1", roles: ["COLLECTOR"] };

const COMPLETE: EvidenceStatus = evidenceStatus(
  { idFrontFilename: "a.jpg", idBackFilename: "b.jpg" },
  3,
  3
);

function app(
  status: Status,
  over: Partial<ApplicationForTransition> = {}
): ApplicationForTransition {
  return {
    status,
    assignedReviewerId: FOUNDER.id,
    reviewerRecommendation: "Aprobar",
    contractFilename: "c.pdf",
    approvedAmount: 10000,
    contractTerms: { installments: 10, installmentAmount: 1300, frequency: "WEEKLY" },
    ...over
  };
}

/** Input that satisfies every action's input requirements. */
const FULL_INPUT: TransitionInput = {
  note: "nota",
  reason: "PAYMENT_CAPACITY",
  approvedAmount: 10000,
  approvedTermWeeks: 10,
  principal: 10000
};

/**
 * The whole status matrix: with an actor who may do anything (admin + assignee)
 * and every requirement met, exactly these (status, action) pairs are allowed.
 * Typed as Record<Status, …> so adding a status without deciding its row fails
 * to compile; the runtime check below also catches enum/table drift.
 */
const ALLOWED: Record<Status, readonly ReviewAction[]> = {
  DRAFT: ["promote"],
  RECEIVED: ["assign"],
  IN_REVIEW: ["assign", "sendToDecision", "reject"],
  PENDING_DECISION: ["returnToReviewer", "approve", "reject"],
  APPROVED: ["withdraw", "convert"],
  CONVERTED: [],
  REJECTED: [],
  ABANDONED: []
};

const TARGET: Record<ReviewAction, Status> = {
  promote: "RECEIVED",
  assign: "IN_REVIEW",
  sendToDecision: "PENDING_DECISION",
  returnToReviewer: "IN_REVIEW",
  approve: "APPROVED",
  reject: "REJECTED",
  withdraw: "ABANDONED",
  convert: "CONVERTED"
};

describe("evaluateTransition — status matrix", () => {
  it("has a row for every ApplicationStatus", () => {
    expect(Object.keys(ALLOWED).sort()).to.deep.equal([...applicationStatusEnum.options].sort());
  });

  for (const status of applicationStatusEnum.options) {
    for (const action of REVIEW_ACTIONS) {
      const allowed = ALLOWED[status].includes(action);
      it(`${status} × ${action} → ${allowed ? TARGET[action] : "WRONG_STATUS"}`, () => {
        const r = evaluateTransition(app(status), action, FOUNDER, FULL_INPUT, {
          evidence: COMPLETE
        });
        if (allowed) expect(r).to.deep.equal({ ok: true, to: TARGET[action] });
        else expect(r).to.deep.equal({ ok: false, reason: "WRONG_STATUS" });
      });
    }
  }
});

describe("evaluateTransition — roles", () => {
  it("rejects callers without a review role before anything else", () => {
    for (const action of REVIEW_ACTIONS) {
      const r = evaluateTransition(app("DRAFT"), action, COLLECTOR, FULL_INPUT);
      expect(r).to.deep.equal({ ok: false, reason: "NOT_ALLOWED" });
    }
  });

  it("lets any reviewer take from the queue", () => {
    const r = evaluateTransition(app("RECEIVED", { assignedReviewerId: null }), "assign", REVIEWER);
    expect(r).to.deep.equal({ ok: true, to: "IN_REVIEW" });
  });

  it("only admins assign to someone else", () => {
    const input = { assigneeId: OTHER_REVIEWER.id, assigneeRoles: OTHER_REVIEWER.roles };
    expect(
      evaluateTransition(app("RECEIVED", { assignedReviewerId: null }), "assign", REVIEWER, input)
    ).to.deep.equal({ ok: false, reason: "NOT_ALLOWED" });
    expect(
      evaluateTransition(app("RECEIVED", { assignedReviewerId: null }), "assign", ADMIN, input)
    ).to.deep.equal({ ok: true, to: "IN_REVIEW" });
  });

  it("only admins reassign an application already in review", () => {
    const inReview = app("IN_REVIEW", { assignedReviewerId: REVIEWER.id });
    expect(evaluateTransition(inReview, "assign", OTHER_REVIEWER)).to.deep.equal({
      ok: false,
      reason: "NOT_ALLOWED"
    });
    const input = { assigneeId: OTHER_REVIEWER.id, assigneeRoles: OTHER_REVIEWER.roles };
    expect(evaluateTransition(inReview, "assign", ADMIN, input)).to.deep.equal({
      ok: true,
      to: "IN_REVIEW"
    });
  });

  it("refuses to assign to a user who is not a reviewer", () => {
    const input = { assigneeId: COLLECTOR.id, assigneeRoles: COLLECTOR.roles };
    expect(
      evaluateTransition(app("RECEIVED", { assignedReviewerId: null }), "assign", ADMIN, input)
    ).to.deep.equal({ ok: false, reason: "ASSIGNEE_NOT_REVIEWER" });
  });

  it("only the assignee sends to decision — even an admin who is not assigned", () => {
    const a = app("IN_REVIEW", { assignedReviewerId: REVIEWER.id });
    const ctx = { evidence: COMPLETE };
    expect(evaluateTransition(a, "sendToDecision", OTHER_REVIEWER, {}, ctx).ok).to.equal(false);
    expect(evaluateTransition(a, "sendToDecision", ADMIN, {}, ctx)).to.deep.equal({
      ok: false,
      reason: "NOT_ASSIGNEE"
    });
    expect(evaluateTransition(a, "sendToDecision", REVIEWER, {}, ctx).ok).to.equal(true);
  });

  it("decisions on a pending application are admin-only", () => {
    const a = app("PENDING_DECISION", { assignedReviewerId: REVIEWER.id });
    for (const action of ["approve", "returnToReviewer", "reject"] as const) {
      expect(evaluateTransition(a, action, REVIEWER, FULL_INPUT)).to.deep.equal({
        ok: false,
        reason: "NOT_ALLOWED"
      });
      expect(evaluateTransition(a, action, ADMIN, FULL_INPUT).ok).to.equal(true);
    }
  });

  it("the assignee (not another reviewer) rejects during review", () => {
    const a = app("IN_REVIEW", { assignedReviewerId: REVIEWER.id });
    expect(evaluateTransition(a, "reject", REVIEWER, FULL_INPUT).ok).to.equal(true);
    expect(evaluateTransition(a, "reject", OTHER_REVIEWER, FULL_INPUT)).to.deep.equal({
      ok: false,
      reason: "NOT_ASSIGNEE"
    });
  });

  it("the assignee or an admin withdraws and converts", () => {
    const a = app("APPROVED", { assignedReviewerId: REVIEWER.id });
    for (const action of ["withdraw", "convert"] as const) {
      expect(evaluateTransition(a, action, REVIEWER, FULL_INPUT).ok).to.equal(true);
      expect(evaluateTransition(a, action, ADMIN, FULL_INPUT).ok).to.equal(true);
      expect(evaluateTransition(a, action, OTHER_REVIEWER, FULL_INPUT)).to.deep.equal({
        ok: false,
        reason: "NOT_ASSIGNEE"
      });
    }
  });
});

describe("evaluateTransition — requirements", () => {
  it("sendToDecision needs complete evidence, then a recommendation", () => {
    const a = app("IN_REVIEW");
    const partial = evidenceStatus({ idFrontFilename: "a.jpg", idBackFilename: null }, 3, 3);
    expect(
      evaluateTransition(a, "sendToDecision", FOUNDER, {}, { evidence: partial })
    ).to.deep.equal({ ok: false, reason: "EVIDENCE_INCOMPLETE" });
    expect(evaluateTransition(a, "sendToDecision", FOUNDER, {}, {})).to.deep.equal({
      ok: false,
      reason: "EVIDENCE_INCOMPLETE"
    });
    expect(
      evaluateTransition(
        app("IN_REVIEW", { reviewerRecommendation: "  " }),
        "sendToDecision",
        FOUNDER,
        {},
        {
          evidence: COMPLETE
        }
      )
    ).to.deep.equal({ ok: false, reason: "RECOMMENDATION_REQUIRED" });
  });

  it("returnToReviewer needs a note", () => {
    expect(
      evaluateTransition(app("PENDING_DECISION"), "returnToReviewer", ADMIN, {})
    ).to.deep.equal({
      ok: false,
      reason: "NOTE_REQUIRED"
    });
  });

  it("approve needs a positive amount and a whole number of weeks", () => {
    const a = app("PENDING_DECISION");
    for (const bad of [
      {},
      { approvedAmount: 0, approvedTermWeeks: 10 },
      { approvedAmount: 10000, approvedTermWeeks: 1.5 }
    ]) {
      expect(evaluateTransition(a, "approve", ADMIN, bad)).to.deep.equal({
        ok: false,
        reason: "TERMS_REQUIRED"
      });
    }
  });

  it("reject needs a reason, and a note when the reason is OTHER", () => {
    const a = app("PENDING_DECISION");
    expect(evaluateTransition(a, "reject", ADMIN, {})).to.deep.equal({
      ok: false,
      reason: "REASON_REQUIRED"
    });
    expect(evaluateTransition(a, "reject", ADMIN, { reason: "OTHER" })).to.deep.equal({
      ok: false,
      reason: "NOTE_REQUIRED"
    });
    expect(evaluateTransition(a, "reject", ADMIN, { reason: "OTHER", note: "x" }).ok).to.equal(
      true
    );
  });

  it("convert needs the signed contract and the approved amount as principal", () => {
    expect(
      evaluateTransition(app("APPROVED", { contractFilename: null }), "convert", ADMIN, FULL_INPUT)
    ).to.deep.equal({ ok: false, reason: "CONTRACT_REQUIRED" });
    expect(
      evaluateTransition(app("APPROVED", { approvedAmount: null }), "convert", ADMIN, FULL_INPUT)
    ).to.deep.equal({ ok: false, reason: "TERMS_REQUIRED" });
    expect(
      evaluateTransition(app("APPROVED"), "convert", ADMIN, { principal: 12000 })
    ).to.deep.equal({ ok: false, reason: "AMOUNT_MISMATCH" });
  });

  it("a contract signed before this flow converts with the operator's principal", () => {
    // Migrated SIGNED application: signed contract, no stored terms, and an old
    // form that never recorded an amount.
    const legacy = app("APPROVED", { approvedAmount: null, contractTerms: null });
    expect(evaluateTransition(legacy, "convert", ADMIN, { principal: 8000 }).ok).to.equal(true);
    expect(evaluateTransition(legacy, "convert", ADMIN, {})).to.deep.equal({
      ok: false,
      reason: "TERMS_REQUIRED"
    });
    // With an amount on record, the principal must still match it.
    const withAmount = app("APPROVED", { contractTerms: null });
    expect(evaluateTransition(withAmount, "convert", ADMIN, { principal: 8000 })).to.deep.equal({
      ok: false,
      reason: "AMOUNT_MISMATCH"
    });
  });

  it("ignoreInput enables a button before its input is typed, but never state blocks", () => {
    const opts = { ignoreInput: true };
    expect(evaluateTransition(app("PENDING_DECISION"), "reject", ADMIN, {}, {}, opts).ok).to.equal(
      true
    );
    expect(
      evaluateTransition(
        app("APPROVED", { contractFilename: null }),
        "convert",
        ADMIN,
        {},
        {},
        opts
      )
    ).to.deep.equal({ ok: false, reason: "CONTRACT_REQUIRED" });
  });
});

describe("evidenceStatus", () => {
  it("needs both cédula sides and the minimum photos", () => {
    expect(evidenceStatus({ idFrontFilename: "a", idBackFilename: "b" }, 2, 3)).to.deep.equal({
      idFront: true,
      idBack: true,
      businessPhotos: { have: 2, need: 3 },
      complete: false
    });
    expect(evidenceStatus({ idFrontFilename: "a", idBackFilename: "b" }, 3, 3).complete).to.equal(
      true
    );
    expect(evidenceStatus({ idFrontFilename: null, idBackFilename: "b" }, 9, 3).complete).to.equal(
      false
    );
  });

  it("a zero minimum only needs the cédula", () => {
    expect(evidenceStatus({ idFrontFilename: "a", idBackFilename: "b" }, 0, 0).complete).to.equal(
      true
    );
  });
});

describe("transitionBlockCode", () => {
  it("maps role blocks to FORBIDDEN, input blocks to BAD_REQUEST, state blocks to CONFLICT", () => {
    expect(transitionBlockCode("NOT_ALLOWED")).to.equal("FORBIDDEN");
    expect(transitionBlockCode("NOT_ASSIGNEE")).to.equal("FORBIDDEN");
    expect(transitionBlockCode("NOTE_REQUIRED")).to.equal("BAD_REQUEST");
    expect(transitionBlockCode("AMOUNT_MISMATCH")).to.equal("BAD_REQUEST");
    expect(transitionBlockCode("WRONG_STATUS")).to.equal("CONFLICT");
    expect(transitionBlockCode("EVIDENCE_INCOMPLETE")).to.equal("CONFLICT");
  });
});
