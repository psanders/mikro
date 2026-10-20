/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import {
  RENEWAL_ACTIONS,
  RENEWAL_ACTION_SOURCE_STATUSES,
  OPEN_RENEWAL_STATUSES,
  evaluateRenewalTransition,
  isOpenRenewalStatus,
  loanRenewalStatusEnum,
  renewalBlockCode,
  renewalNet,
  startLoanRenewalSchema,
  updateRenewalTermsSchema,
  uploadRenewalSignedContractSchema,
  finalizeLoanRenewalSchema,
  type LoanRenewalStatus,
  type RenewalActor,
  type RenewalForTransition
} from "../../src/schemas/loanRenewal.js";
import {
  SEARCHABLE_APPLICATION_STATUSES,
  applicationStatusEnum,
  isSearchableApplicationStatus
} from "../../src/schemas/application.js";
import { updateCustomerSchema } from "../../src/schemas/customer.js";
import { businessEventPayloadSchemas } from "../../src/schemas/businessEvent.js";

const ADMIN: RenewalActor = { id: "admin-1", roles: ["ADMIN"] };
const REVIEWER: RenewalActor = { id: "rev-1", roles: ["REVIEWER"] };
const COLLECTOR: RenewalActor = { id: "col-1", roles: ["COLLECTOR"] };

const renewal = (
  status: LoanRenewalStatus,
  over: Partial<RenewalForTransition> = {}
): RenewalForTransition => ({ status, contractFilename: null, ...over });

describe("loan renewal transitions", () => {
  it("covers every status in the enum", () => {
    expect(loanRenewalStatusEnum.options).to.deep.equal([
      "DRAFT",
      "CONTRACT_READY",
      "SIGNED",
      "COMPLETED",
      "CANCELLED"
    ]);
  });

  it("treats exactly DRAFT, CONTRACT_READY and SIGNED as open", () => {
    for (const s of loanRenewalStatusEnum.options) {
      expect(isOpenRenewalStatus(s)).to.equal(
        (OPEN_RENEWAL_STATUSES as readonly string[]).includes(s)
      );
    }
    expect(isOpenRenewalStatus("COMPLETED")).to.equal(false);
    expect(isOpenRenewalStatus("CANCELLED")).to.equal(false);
  });

  it("never offers any action from a finished renewal", () => {
    for (const status of ["COMPLETED", "CANCELLED"] as const) {
      for (const action of RENEWAL_ACTIONS) {
        const r = evaluateRenewalTransition(renewal(status), action, ADMIN);
        expect(r, `${action} from ${status}`).to.deep.equal({ ok: false, reason: "WRONG_STATUS" });
      }
    }
  });

  it("lets admins and reviewers act, and rejects everyone else", () => {
    for (const actor of [ADMIN, REVIEWER]) {
      const r = evaluateRenewalTransition(renewal("DRAFT"), "generateContract", actor);
      expect(r).to.deep.equal({ ok: true, to: "CONTRACT_READY" });
    }
    const denied = evaluateRenewalTransition(renewal("DRAFT"), "cancel", COLLECTOR);
    expect(denied).to.deep.equal({ ok: false, reason: "NOT_ALLOWED" });
  });

  it("can cancel from every open status", () => {
    for (const status of OPEN_RENEWAL_STATUSES) {
      expect(evaluateRenewalTransition(renewal(status), "cancel", REVIEWER)).to.deep.equal({
        ok: true,
        to: "CANCELLED"
      });
    }
  });

  it("returns to DRAFT whenever the terms change", () => {
    for (const status of RENEWAL_ACTION_SOURCE_STATUSES.updateTerms) {
      const r = evaluateRenewalTransition(renewal(status), "updateTerms", REVIEWER, {
        principal: 10_000
      });
      expect(r).to.deep.equal({ ok: true, to: "DRAFT" });
    }
  });

  it("cannot regenerate a contract that was already signed", () => {
    const r = evaluateRenewalTransition(renewal("SIGNED"), "generateContract", ADMIN);
    expect(r).to.deep.equal({ ok: false, reason: "WRONG_STATUS" });
  });

  it("requires a generated contract before a signed one", () => {
    const none = evaluateRenewalTransition(renewal("DRAFT"), "uploadSignedContract", ADMIN);
    expect(none).to.deep.equal({ ok: false, reason: "WRONG_STATUS" });
    const missing = evaluateRenewalTransition(
      renewal("CONTRACT_READY"),
      "uploadSignedContract",
      ADMIN
    );
    expect(missing).to.deep.equal({ ok: false, reason: "CONTRACT_REQUIRED" });
    const ok = evaluateRenewalTransition(
      renewal("CONTRACT_READY", { contractFilename: "c.pdf" }),
      "uploadSignedContract",
      ADMIN
    );
    expect(ok).to.deep.equal({ ok: true, to: "SIGNED" });
  });

  it("a supporting document keeps a draft a draft, and makes a contracted renewal ready", () => {
    expect(evaluateRenewalTransition(renewal("DRAFT"), "uploadDocument", ADMIN)).to.deep.equal({
      ok: true,
      to: "DRAFT"
    });
    expect(
      evaluateRenewalTransition(renewal("CONTRACT_READY"), "uploadDocument", ADMIN)
    ).to.deep.equal({
      ok: true,
      to: "SIGNED"
    });
    expect(evaluateRenewalTransition(renewal("SIGNED"), "uploadDocument", ADMIN)).to.deep.equal({
      ok: true,
      to: "SIGNED"
    });
  });

  it("rejects terms whose principal does not cover what is owed", () => {
    const low = evaluateRenewalTransition(
      renewal("DRAFT"),
      "updateTerms",
      REVIEWER,
      { principal: 2_000 },
      { owed: 2_500 }
    );
    expect(low).to.deep.equal({ ok: false, reason: "NET_NOT_POSITIVE" });
    const equal = evaluateRenewalTransition(
      renewal("DRAFT"),
      "updateTerms",
      REVIEWER,
      { principal: 2_500 },
      { owed: 2_500 }
    );
    expect(equal).to.deep.equal({ ok: false, reason: "NET_NOT_POSITIVE" });
    const ok = evaluateRenewalTransition(
      renewal("DRAFT"),
      "updateTerms",
      REVIEWER,
      { principal: 10_000 },
      { owed: 2_500 }
    );
    expect(ok.ok).to.equal(true);
  });

  it("blocks edits and finalize once the old loan is no longer active", () => {
    for (const [status, action] of [
      ["DRAFT", "updateTerms"],
      ["DRAFT", "generateContract"],
      ["SIGNED", "finalize"]
    ] as const) {
      const r = evaluateRenewalTransition(
        renewal(status),
        action,
        ADMIN,
        { confirmedNet: 7_500 },
        { oldLoanActive: false }
      );
      expect(r, action).to.deep.equal({ ok: false, reason: "OLD_LOAN_NOT_ACTIVE" });
    }
  });

  describe("finalize", () => {
    const signed = renewal("SIGNED", { contractFilename: "c.pdf" });

    it("only runs from SIGNED", () => {
      for (const status of ["DRAFT", "CONTRACT_READY"] as const) {
        const r = evaluateRenewalTransition(renewal(status), "finalize", ADMIN, {
          confirmedNet: 7_500
        });
        expect(r).to.deep.equal({ ok: false, reason: "WRONG_STATUS" });
      }
    });

    it("needs the net the user confirmed", () => {
      const r = evaluateRenewalTransition(
        signed,
        "finalize",
        REVIEWER,
        { principal: 10_000 },
        { owed: 2_500 }
      );
      expect(r).to.deep.equal({ ok: false, reason: "CONFIRMATION_REQUIRED" });
    });

    it("completes when the confirmed net matches: owes 2,500, new loan 10,000 → 7,500", () => {
      expect(renewalNet(10_000, 2_500)).to.equal(7_500);
      const r = evaluateRenewalTransition(
        signed,
        "finalize",
        REVIEWER,
        { principal: 10_000, confirmedNet: 7_500 },
        { owed: 2_500, oldLoanActive: true }
      );
      expect(r).to.deep.equal({ ok: true, to: "COMPLETED" });
    });

    it("fails with NET_CHANGED when what is owed moved since the user confirmed", () => {
      // 50 of mora accrued overnight: owed is now 2,550, so the net is 7,450.
      const r = evaluateRenewalTransition(
        signed,
        "finalize",
        REVIEWER,
        { principal: 10_000, confirmedNet: 7_500 },
        { owed: 2_550 }
      );
      expect(r).to.deep.equal({ ok: false, reason: "NET_CHANGED" });
      const again = evaluateRenewalTransition(
        signed,
        "finalize",
        REVIEWER,
        { principal: 10_000, confirmedNet: 7_450 },
        { owed: 2_550 }
      );
      expect(again).to.deep.equal({ ok: true, to: "COMPLETED" });
    });

    it("compares at cents, not floating point", () => {
      const r = evaluateRenewalTransition(
        signed,
        "finalize",
        ADMIN,
        { principal: 10_000.1, confirmedNet: 7_500.03 },
        { owed: 2_500.07 }
      );
      expect(r).to.deep.equal({ ok: true, to: "COMPLETED" });
    });

    it("refuses a non-positive net", () => {
      const r = evaluateRenewalTransition(
        signed,
        "finalize",
        ADMIN,
        { principal: 2_000, confirmedNet: 100 },
        { owed: 2_500 }
      );
      expect(r).to.deep.equal({ ok: false, reason: "NET_NOT_POSITIVE" });
    });

    it("ignoreInput lets the UI enable the button before the net is confirmed", () => {
      const r = evaluateRenewalTransition(
        signed,
        "finalize",
        ADMIN,
        { principal: 10_000 },
        { owed: 2_500 },
        { ignoreInput: true }
      );
      expect(r).to.deep.equal({ ok: true, to: "COMPLETED" });
    });
  });

  it("maps blocks to tRPC codes", () => {
    expect(renewalBlockCode("NOT_ALLOWED")).to.equal("FORBIDDEN");
    expect(renewalBlockCode("NET_NOT_POSITIVE")).to.equal("BAD_REQUEST");
    expect(renewalBlockCode("CONFIRMATION_REQUIRED")).to.equal("BAD_REQUEST");
    for (const b of [
      "WRONG_STATUS",
      "CONTRACT_REQUIRED",
      "OLD_LOAN_NOT_ACTIVE",
      "NET_CHANGED"
    ] as const) {
      expect(renewalBlockCode(b)).to.equal("CONFLICT");
    }
  });
});

describe("loan renewal inputs", () => {
  it("start accepts a loan number and optional terms", () => {
    expect(startLoanRenewalSchema.safeParse({ loanId: 10034 }).success).to.equal(true);
    expect(
      startLoanRenewalSchema.safeParse({
        loanId: 10034,
        terms: { principal: 10_000, termLength: 10 }
      }).success
    ).to.equal(true);
    expect(startLoanRenewalSchema.safeParse({ loanId: 0 }).success).to.equal(false);
  });

  it("update-terms needs at least one term", () => {
    const id = "5b0f8f4e-8a0e-4b2a-9d6c-3f1f2a1c7e11";
    expect(updateRenewalTermsSchema.safeParse({ id, terms: {} }).success).to.equal(false);
    expect(
      updateRenewalTermsSchema.safeParse({ id, terms: { principal: 9_000 } }).success
    ).to.equal(true);
  });

  it("the signed contract must be a PDF", () => {
    const base = {
      id: "5b0f8f4e-8a0e-4b2a-9d6c-3f1f2a1c7e11",
      originalName: "c.pdf",
      dataBase64: "QUJD"
    };
    expect(
      uploadRenewalSignedContractSchema.safeParse({ ...base, mimeType: "application/pdf" }).success
    ).to.equal(true);
    expect(
      uploadRenewalSignedContractSchema.safeParse({ ...base, mimeType: "image/png" }).success
    ).to.equal(false);
  });

  it("finalize needs a positive confirmed net", () => {
    const id = "5b0f8f4e-8a0e-4b2a-9d6c-3f1f2a1c7e11";
    expect(finalizeLoanRenewalSchema.safeParse({ id, confirmedNet: 7_500 }).success).to.equal(true);
    expect(finalizeLoanRenewalSchema.safeParse({ id, confirmedNet: 0 }).success).to.equal(false);
    expect(finalizeLoanRenewalSchema.safeParse({ id }).success).to.equal(false);
  });
});

describe("renewal events", () => {
  const base = {
    renewalId: "5b0f8f4e-8a0e-4b2a-9d6c-3f1f2a1c7e11",
    loanId: "6c1a9a5f-9b1f-4c3b-8e7d-4a2a3b2d8f22",
    oldLoanNumber: 10034,
    customerId: "7d2baa60-ac20-4d4c-9f8e-5b3b4c3e9a33",
    principal: 10_000,
    installments: 10,
    frequency: "WEEKLY",
    installmentAmount: 1_300
  };

  it("registers a payload schema for every renewal event type", () => {
    for (const t of [
      "loan.renewal.started",
      "loan.renewal.terms_updated",
      "loan.renewal.contract_generated",
      "loan.renewal.document_uploaded",
      "loan.renewal.cancelled",
      "loan.renewal.completed"
    ] as const) {
      expect(businessEventPayloadSchemas[t], t).to.not.equal(undefined);
    }
  });

  it("every payload carries the three join ids", () => {
    const noRenewalId: Record<string, unknown> = { ...base };
    delete noRenewalId.renewalId;
    expect(
      businessEventPayloadSchemas["loan.renewal.terms_updated"]!.safeParse(base).success
    ).to.equal(true);
    expect(
      businessEventPayloadSchemas["loan.renewal.terms_updated"]!.safeParse(noRenewalId).success
    ).to.equal(false);
  });

  it("completed records what was owed and the net posted", () => {
    const payload = {
      ...base,
      newLoanId: "8e3cbb71-bd31-4e5d-8a9f-6c4c5d4f0b44",
      newLoanNumber: 10051,
      owed: 2_500,
      netDisbursed: 7_500,
      transactionId: "9f4dcc82-ce42-4f6e-9bb0-7d5d6e5a1c55",
      accountName: "Caja"
    };
    expect(
      businessEventPayloadSchemas["loan.renewal.completed"]!.safeParse(payload).success
    ).to.equal(true);
    const partial: Record<string, unknown> = { ...payload };
    delete partial.netDisbursed;
    expect(
      businessEventPayloadSchemas["loan.renewal.completed"]!.safeParse(partial).success
    ).to.equal(false);
  });
});

describe("searchable applications", () => {
  it("leaves out only DRAFT and ABANDONED", () => {
    const left = applicationStatusEnum.options.filter((s) => !isSearchableApplicationStatus(s));
    expect(left).to.have.members(["DRAFT", "ABANDONED"]);
    expect(SEARCHABLE_APPLICATION_STATUSES).to.have.length(
      applicationStatusEnum.options.length - 2
    );
  });
});

describe("updateCustomerSchema (profile edits)", () => {
  const id = "5b0f8f4e-8a0e-4b2a-9d6c-3f1f2a1c7e11";

  it("accepts the profile fields and validates the cédula like creation", () => {
    expect(
      updateCustomerSchema.safeParse({
        id,
        idNumber: "031-0567812-4",
        homeAddress: "C/ Duarte #14",
        jobPosition: null,
        income: 38_000,
        isBusinessOwner: true
      }).success
    ).to.equal(true);
    expect(updateCustomerSchema.safeParse({ id, idNumber: "03105678124" }).success).to.equal(false);
  });

  it("can clear nullable fields", () => {
    const r = updateCustomerSchema.safeParse({ id, collectionPoint: null, income: null });
    expect(r.success).to.equal(true);
  });
});
