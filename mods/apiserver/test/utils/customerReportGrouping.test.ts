/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { buildGroupedCustomerRows } from "@mikro/common";

describe("buildGroupedCustomerRows", () => {
  it("shows pagos capped at term and ignores PARTIAL for completed count (10/10, al día)", () => {
    const createdAt = new Date("2020-01-01");
    const customers = [
      {
        name: "Full Name",
        nickname: "Pepe",
        phone: "18091234567",
        preferredPaymentDay: null as string | null,
        loans: [
          {
            loanId: 10000,
            paymentFrequency: "WEEKLY",
            createdAt,
            startingDate: null,
            termLength: 10,
            payments: [
              ...Array.from({ length: 10 }, (_, i) => ({
                paidAt: new Date(createdAt.getTime() + (i + 1) * 7 * 86400000),
                status: "COMPLETED" as const
              })),
              {
                paidAt: new Date(createdAt.getTime() + 200 * 86400000),
                status: "PARTIAL" as const
              }
            ],
            nickname: "LoanNick"
          }
        ]
      }
    ];

    const grouped = buildGroupedCustomerRows(customers, new Date("2026-06-01"));
    const allRows = [...grouped.critico, ...grouped.requiereAtencion, ...grouped.alDia];
    expect(allRows).to.have.length(1);
    const row = allRows[0];
    expect(row.nickname).to.equal("Pepe");
    expect(row.paymentsMade).to.equal(10);
    expect(row.termLength).to.equal(10);
    expect(row.missedCount).to.equal(0);
    expect(row.rating).to.be.oneOf([4, 5]);
  });

  it("falls back to loan.nickname when customer.nickname is missing", () => {
    const createdAt = new Date("2020-01-01");
    const customers = [
      {
        name: "Full Name",
        nickname: null as string | null,
        phone: "18091234567",
        preferredPaymentDay: null as string | null,
        loans: [
          {
            loanId: 10001,
            paymentFrequency: "WEEKLY",
            createdAt,
            startingDate: null,
            termLength: 5,
            payments: [],
            nickname: "LoanNick"
          }
        ]
      }
    ];

    const grouped = buildGroupedCustomerRows(customers, new Date("2026-06-01"));
    const allRows = [...grouped.critico, ...grouped.requiereAtencion, ...grouped.alDia];
    expect(allRows).to.have.length(1);
    expect(allRows[0].name).to.equal("Full Name");
    expect(allRows[0].nickname).to.equal("LoanNick");
  });

  it("returns empty nickname when neither customer nor loan nickname is set", () => {
    const createdAt = new Date("2020-01-01");
    const customers = [
      {
        name: "Full Name",
        nickname: null as string | null,
        phone: "18091234567",
        preferredPaymentDay: null as string | null,
        loans: [
          {
            loanId: 10002,
            paymentFrequency: "WEEKLY",
            createdAt,
            startingDate: null,
            termLength: 5,
            payments: [],
            nickname: null as string | null
          }
        ]
      }
    ];

    const grouped = buildGroupedCustomerRows(customers, new Date("2026-06-01"));
    const allRows = [...grouped.critico, ...grouped.requiereAtencion, ...grouped.alDia];
    expect(allRows).to.have.length(1);
    expect(allRows[0].nickname).to.equal("");
  });
});
