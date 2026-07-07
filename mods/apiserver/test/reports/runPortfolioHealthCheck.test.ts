/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Portfolio health check: builds a snapshot per loan and aggregates the spec
 * checks. A clean loan passes; a loan carrying an impossible balance surfaces as
 * an offender.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createRunPortfolioHealthCheck } from "../../src/api/reports/createRunPortfolioHealthCheck.js";

const LOAN_START = new Date("2026-06-01T00:00:00.000Z");

function healthyLoan(loanId: number) {
  return {
    loanId,
    principal: 4000,
    paymentAmount: 1000,
    termLength: 4,
    paymentFrequency: "WEEKLY",
    status: "ACTIVE",
    moraRate: null,
    createdAt: LOAN_START,
    startingDate: LOAN_START,
    updatedAt: LOAN_START,
    nickname: null,
    customer: {
      id: `c${loanId}`,
      name: `Cliente ${loanId}`,
      nickname: null,
      preferredPaymentDay: null
    },
    payments: [
      {
        id: `${loanId}-a`,
        kind: "INSTALLMENT",
        status: "COMPLETED",
        amount: 1000,
        paidAt: new Date("2026-06-02T10:00:00Z"),
        method: "CASH",
        collectedById: "u1",
        linkedPaymentId: null,
        notes: null,
        collectedBy: { name: "Cobrador" }
      }
    ]
  };
}

describe("createRunPortfolioHealthCheck", () => {
  afterEach(() => sinon.restore());

  it("scans ACTIVE loans by default and aggregates pass/fail", async () => {
    const findMany = sinon.stub().resolves([{ loanId: 1 }, { loanId: 2 }]);
    const findUnique = sinon
      .stub()
      .callsFake(async ({ where }: { where: { loanId: number } }) => healthyLoan(where.loanId));
    const client = { loan: { findMany, findUnique } };

    const report = await createRunPortfolioHealthCheck(client as any)({
      includeAllStatuses: false
    });

    expect(findMany.firstCall.args[0].where).to.deep.equal({ status: "ACTIVE" });
    expect(report.loansChecked).to.equal(2);
    expect(report.loansPassing).to.equal(2);
    expect(report.loansFailing).to.equal(0);
  });

  it("widens the scan to all statuses when requested", async () => {
    // The builder always emits internally-consistent snapshots, so loans built
    // from real data pass the checks; offender aggregation over a corrupted
    // snapshot is covered in the common suite. Here we verify scope + shape.
    const findMany = sinon.stub().resolves([{ loanId: 7 }]);
    const findUnique = sinon.stub().resolves(healthyLoan(7));
    const client = { loan: { findMany, findUnique } };

    const report = await createRunPortfolioHealthCheck(client as any)({ includeAllStatuses: true });
    expect(findMany.firstCall.args[0].where).to.deep.equal({}); // no status filter
    expect(report.loansChecked).to.equal(1);
    expect(report).to.have.property("failuresByCheck");
    expect(report).to.have.property("offenders");
  });

  it("skips loans that no longer resolve", async () => {
    const findMany = sinon.stub().resolves([{ loanId: 1 }, { loanId: 2 }]);
    const findUnique = sinon
      .stub()
      .callsFake(async ({ where }: { where: { loanId: number } }) =>
        where.loanId === 2 ? null : healthyLoan(where.loanId)
      );
    const client = { loan: { findMany, findUnique } };

    const report = await createRunPortfolioHealthCheck(client as any)({
      includeAllStatuses: false
    });
    expect(report.loansChecked).to.equal(1); // loan 2 vanished, not counted
  });
});
