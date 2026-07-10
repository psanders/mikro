/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { buildGroupedCustomerRows, type CustomerForGrouping } from "@mikro/common";

describe("buildGroupedCustomerRows", () => {
  let clock: sinon.SinonFakeTimers;

  afterEach(() => {
    if (clock) clock.restore();
  });

  function createCustomer(
    overrides: Partial<CustomerForGrouping> & { name: string }
  ): CustomerForGrouping {
    return {
      name: overrides.name,
      phone: overrides.phone ?? "",
      loans: overrides.loans ?? []
    };
  }

  function createLoan(loanId: number, createdAt: Date, payments: Array<{ paidAt: Date }>) {
    return {
      loanId,
      paymentFrequency: "WEEKLY" as const,
      createdAt,
      payments
    };
  }

  it("returns empty groups when no customers", () => {
    const result = buildGroupedCustomerRows([]);
    expect(result.alDia).to.deep.equal([]);
    expect(result.requiereAtencion).to.deep.equal([]);
    expect(result.critico).to.deep.equal([]);
  });

  it("puts on-time loan in alDia (rating 5)", () => {
    clock = sinon.useFakeTimers(new Date("2026-01-22"));
    const customers: CustomerForGrouping[] = [
      createCustomer({
        name: "Ana",
        loans: [
          createLoan(101, new Date("2026-01-01"), [
            { paidAt: new Date("2026-01-08") },
            { paidAt: new Date("2026-01-15") },
            { paidAt: new Date("2026-01-22") }
          ])
        ]
      })
    ];
    const result = buildGroupedCustomerRows(customers);
    expect(result.critico).to.have.length(0);
    expect(result.requiereAtencion).to.have.length(0);
    expect(result.alDia).to.have.length(1);
    expect(result.alDia[0]).to.include({
      name: "Ana",
      phone: "",
      loanId: 101,
      rating: 5,
      missedCount: 0
    });
  });

  it("puts one missed cycle in requiereAtencion (rating 3)", () => {
    clock = sinon.useFakeTimers(new Date("2026-01-22"));
    const customers: CustomerForGrouping[] = [
      createCustomer({
        name: "Bob",
        loans: [
          createLoan(102, new Date("2026-01-01"), [
            { paidAt: new Date("2026-01-08") },
            { paidAt: new Date("2026-01-15") }
          ])
        ]
      })
    ];
    const result = buildGroupedCustomerRows(customers);
    expect(result.critico).to.have.length(0);
    expect(result.alDia).to.have.length(0);
    expect(result.requiereAtencion).to.have.length(1);
    expect(result.requiereAtencion[0]).to.include({ name: "Bob", phone: "", missedCount: 1 });
  });

  it("puts multiple missed cycles in critico (rating 1)", () => {
    clock = sinon.useFakeTimers(new Date("2026-01-22"));
    const customers: CustomerForGrouping[] = [
      createCustomer({
        name: "Carlos",
        loans: [createLoan(103, new Date("2026-01-01"), [{ paidAt: new Date("2026-01-08") }])]
      })
    ];
    const result = buildGroupedCustomerRows(customers);
    expect(result.alDia).to.have.length(0);
    expect(result.requiereAtencion).to.have.length(0);
    expect(result.critico).to.have.length(1);
    expect(result.critico[0]).to.include({ name: "Carlos", phone: "", missedCount: 2 });
    expect(result.critico[0].rating).to.equal(1);
  });

  it("sorts within each group by rating then missed count desc", () => {
    clock = sinon.useFakeTimers(new Date("2026-01-22"));
    const customers: CustomerForGrouping[] = [
      createCustomer({
        name: "A",
        loans: [createLoan(1, new Date("2026-01-01"), [{ paidAt: new Date("2026-01-08") }])]
      }),
      createCustomer({
        name: "B",
        loans: [createLoan(2, new Date("2026-01-01"), [])]
      })
    ];
    const result = buildGroupedCustomerRows(customers);
    expect(result.critico.map((r) => r.loanId)).to.deep.equal([2, 1]);
  });

  it("rating 4 goes to alDia (boundary)", () => {
    clock = sinon.useFakeTimers(new Date("2026-02-05"));
    // Same pattern as customerReportHelpers "on time with one late in history" -> rating 4
    const customers: CustomerForGrouping[] = [
      createCustomer({
        name: "Diana",
        loans: [
          createLoan(201, new Date("2026-01-01"), [
            { paidAt: new Date("2026-01-20") },
            { paidAt: new Date("2026-01-22") },
            { paidAt: new Date("2026-01-29") },
            { paidAt: new Date("2026-02-02") },
            { paidAt: new Date("2026-02-05") }
          ])
        ]
      })
    ];
    const result = buildGroupedCustomerRows(customers);
    expect(result.critico).to.have.length(0);
    expect(result.requiereAtencion).to.have.length(0);
    expect(result.alDia).to.have.length(1);
    expect(result.alDia[0].rating).to.equal(4);
  });

  it("rating 2 or 3 goes to requiereAtencion (boundary)", () => {
    clock = sinon.useFakeTimers(new Date("2026-01-22"));
    // One missed -> rating 3; requiereAtencion holds rating 2 and 3 (boundary with critico).
    const customers: CustomerForGrouping[] = [
      createCustomer({
        name: "Eve",
        loans: [
          createLoan(202, new Date("2026-01-01"), [
            { paidAt: new Date("2026-01-08") },
            { paidAt: new Date("2026-01-15") }
          ])
        ]
      })
    ];
    const result = buildGroupedCustomerRows(customers);
    expect(result.critico).to.have.length(0);
    expect(result.alDia).to.have.length(0);
    expect(result.requiereAtencion).to.have.length(1);
    expect(result.requiereAtencion[0].rating).to.be.oneOf([2, 3]);
  });

  it("customer with multiple loans in different groups", () => {
    clock = sinon.useFakeTimers(new Date("2026-01-22"));
    const customers: CustomerForGrouping[] = [
      createCustomer({
        name: "Multi",
        phone: "+555",
        loans: [
          createLoan(301, new Date("2026-01-01"), [
            { paidAt: new Date("2026-01-08") },
            { paidAt: new Date("2026-01-15") },
            { paidAt: new Date("2026-01-22") }
          ]),
          createLoan(302, new Date("2026-01-01"), []),
          createLoan(303, new Date("2026-01-01"), [{ paidAt: new Date("2026-01-08") }])
        ]
      })
    ];
    const result = buildGroupedCustomerRows(customers);
    expect(result.alDia).to.have.length(1);
    expect(result.alDia[0].loanId).to.equal(301);
    expect(result.critico).to.have.length(2);
    const criticoIds = result.critico.map((r) => r.loanId).sort((a, b) => a - b);
    expect(criticoIds).to.deep.equal([302, 303]);
    expect(result.alDia[0].phone).to.equal("+555");
    expect(result.critico[0].phone).to.equal("+555");
  });

  it("customer with no loans produces no rows", () => {
    const customers: CustomerForGrouping[] = [createCustomer({ name: "NoLoans", loans: [] })];
    const result = buildGroupedCustomerRows(customers);
    expect(result.alDia).to.have.length(0);
    expect(result.requiereAtencion).to.have.length(0);
    expect(result.critico).to.have.length(0);
  });
});
