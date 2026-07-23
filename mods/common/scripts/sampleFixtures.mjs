/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Shared realistic fixture builders for the six report definitions — used by
 * both the visual-QA sample renderer (`render-samples.mjs`) and the offline
 * render smoke tests (`test/reporting/renderSmoke.test.ts`), so the data the
 * smoke suite guards is exactly the data a human reviews visually. Pure
 * builders, no side effects, no DB/apiserver anywhere.
 */

export const NAMES = [
  "Danny Alexander Capellán Almonte",
  "Pedro Martínez Guzmán",
  "Juana Reyes Fernández",
  "Miguel Santos Peña",
  "Elena Cruz Núñez",
  "María Fernández Rosario",
  "José Ramírez Batista",
  "Rosa Díaz Mercedes",
  "Ana Gómez Ureña",
  "Luis Peña Contreras",
  "Carlos Núñez Vargas",
  "Sofía Herrera Jiménez",
  "Rafael Ortiz Castillo",
  "Yolanda Paulino Beltré",
  "Ramón Feliz Tavárez",
  "Altagracia Cabrera Soto",
  "Wilkin Aquino Medina",
  "Fior Almánzar Rijo",
  "Domingo Encarnación Luna",
  "Xiomara De la Cruz Polanco"
];

export function phone(i) {
  const codes = ["809", "829", "849"];
  return `${codes[i % codes.length]}-555-${String(1000 + i).slice(-4)}`;
}

// ---- loanStatement ----

export function loanStatementFixture({ termLength = 13, frequency = "WEEKLY" } = {}) {
  const cuota = 1250;
  const start = new Date("2026-05-13T00:00:00Z");
  const dayMs = frequency === "DAILY" ? 86_400_000 : 7 * 86_400_000;
  const payments = [];
  const coveredCuotas = Math.min(4, termLength - 1);
  for (let i = 0; i < coveredCuotas; i++) {
    payments.push({
      id: `p${i}`,
      kind: "INSTALLMENT",
      status: "COMPLETED",
      amount: cuota,
      paidAt: new Date(start.getTime() + (i + 1) * dayMs + 3 * 3_600_000).toISOString(),
      method: "CASH"
    });
  }
  // A partial payment on the next cuota, matching the Pencil "Parcial" row.
  payments.push({
    id: "partial",
    kind: "INSTALLMENT",
    status: "PARTIAL",
    amount: cuota - 37.5,
    paidAt: new Date(start.getTime() + (coveredCuotas + 1) * dayMs + 3_600_000).toISOString(),
    method: "CASH"
  });

  return {
    loanId: 10036,
    customer: {
      id: "c-10036",
      name: "Danny Alexander Capellán Almonte",
      nickname: null,
      preferredPaymentDay: null
    },
    loan: {
      principal: cuota * termLength - Math.round(cuota * termLength * 0.354), // ~RD$12,000 for the 13-cuota case
      paymentAmount: cuota,
      termLength,
      paymentFrequency: frequency,
      status: "ACTIVE",
      createdAt: start.toISOString(),
      startingDate: start.toISOString(),
      updatedAt: new Date().toISOString(),
      nickname: null
    },
    payments,
    policy: {
      moraRate: 0.02,
      moraGraceDays: 2,
      moraCapInCuotas: 4,
      moraMinDop: 0,
      moraStopOnDefault: false,
      moraEffectiveFrom: null
    },
    asOf: new Date("2026-07-08T00:00:00Z")
  };
}

// ---- defaultedReport ----

export function defaultedRow(i, { longNote = false } = {}) {
  const notes = [
    "3 sem. sin contacto",
    "Promesa incumplida",
    "Pago parcial 20 jun",
    "Sin notas",
    "Reagendó para viernes"
  ];
  const summary = longNote
    ? "Cliente reporta problemas de ingresos temporales por la temporada baja en su negocio de colmado; acordó retomar pagos la próxima semana tras cobrar una deuda pendiente de un cliente suyo."
    : notes[i % notes.length];
  return {
    name: NAMES[i % NAMES.length],
    nickname: null,
    phone: phone(i),
    loanId: 10029 + i,
    paymentFrequency: "WEEKLY",
    totalPaid: 2000 + i * 137,
    moraCollected: 40 + i * 11.3,
    summary: summary === "Sin notas" ? null : summary,
    isDefaulted: i % 3 === 0
  };
}

export function defaultedFixture(count) {
  const rows = Array.from({ length: count }, (_, i) => defaultedRow(i, { longNote: count > 10 }));
  return {
    totalPrincipalAtRiskDop: 84200,
    generatedAt: new Date("2026-07-08T00:00:00Z"),
    rows
  };
}

// ---- customersReport ----

export function customersFixture(count) {
  const healthCycle = ["critico", "requiereAtencion", "alDia", "alDia", "alDia"];
  const customers = Array.from({ length: count }, (_, i) => {
    const health = healthCycle[i % healthCycle.length];
    const termLength = [10, 12, 13][i % 3];
    const madeByHealth = { critico: 2, requiereAtencion: 5, alDia: termLength - 1 };
    const made = Math.min(madeByHealth[health], termLength);
    const payments = Array.from({ length: made }, (_, p) => ({
      paidAt: new Date(Date.UTC(2026, 0, 1 + p * 7)).toISOString(),
      status: "COMPLETED",
      amount: 1000
    }));
    return {
      name: NAMES[i % NAMES.length],
      phone: phone(i),
      loans: [
        {
          loanId: 10021 + i,
          paymentFrequency: "WEEKLY",
          createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
          startingDate: new Date("2026-01-01T00:00:00Z").toISOString(),
          termLength,
          paymentAmount: 1000,
          payments
        }
      ]
    };
  });
  return {
    asOf: new Date("2026-07-08T00:00:00Z"),
    generatedAt: new Date("2026-07-08T00:00:00Z"),
    customers
  };
}

// ---- renewalReport ----

export function renewalFixture(count) {
  const statuses = [
    { paymentsMade: 9, termLength: 10, isCompleted: false, note: "Elegible: historial impecable" },
    { paymentsMade: 13, termLength: 13, isCompleted: true, note: "Lista para renovar hoy" },
    { paymentsMade: 12, termLength: 13, isCompleted: false, note: "Ofrecer monto mayor" },
    {
      paymentsMade: 6,
      termLength: 12,
      isCompleted: false,
      note: "Aún en curso, revisar en 4 sem."
    },
    { paymentsMade: 4, termLength: 10, isCompleted: false, note: "Buen ritmo, no ofrecer aún" }
  ];
  const rows = Array.from({ length: count }, (_, i) => {
    const s = statuses[i % statuses.length];
    return {
      name: NAMES[i % NAMES.length],
      phone: phone(i),
      loanId: 10052 + i,
      paymentFrequency: "WEEKLY",
      paymentsMade: s.paymentsMade,
      termLength: s.termLength,
      paymentRating: [5, 5, 4, 4, 3][i % 5],
      candidateNote: s.note,
      isCompleted: s.isCompleted,
      suggestedAmountDop: i % 2 === 0 ? 10000 + i * 500 : undefined
    };
  });
  return { generatedAt: new Date("2026-07-08T00:00:00Z"), rows };
}

// ---- accountingReport ----

export function accountingFixture(movimientosCount) {
  const accounts = [
    { name: "Caja Efectivo", kind: "CASH", currency: "DOP", currentBalance: 142050 },
    { name: "Banco Popular", kind: "BANK", currency: "DOP", currentBalance: 620000 },
    { name: "Tarjeta BHD", kind: "CREDIT_CARD", currency: "DOP", currentBalance: 90000 },
    { name: "Reserva operativa", kind: "OTHER", currency: "DOP", currentBalance: 60000 }
  ];
  const typeCycle = [
    { type: "INCOME", categoryName: "Cobro de cuotas", amount: 48200 },
    { type: "EXPENSE", categoryName: "Nómina", amount: 62000 },
    { type: "DEPOSIT", categoryName: "Traspaso de caja", amount: 40000 },
    { type: "WITHDRAWAL", categoryName: "Desembolso préstamo", amount: 12000 },
    { type: "TRANSFER", categoryName: "Ajuste interno", amount: 10000 }
  ];
  const transactions = Array.from({ length: movimientosCount }, (_, i) => {
    const t = typeCycle[i % typeCycle.length];
    return {
      // buildAccountingReportData is called directly here (bypassing the
      // report's zod `z.coerce.date()` input validation), so this must
      // already be a Date, not an ISO string.
      occurredAt: new Date(Date.UTC(2026, 6, 1 + (i % 28))),
      type: t.type,
      accountName: accounts[i % accounts.length].name,
      categoryName: t.categoryName,
      vendor: null,
      description: null,
      amount: t.amount
    };
  });
  return {
    period: { startDate: "2026-07-01", endDate: "2026-07-31" },
    accounts,
    transactions,
    totals: {
      totalIncome: 742300,
      totalExpenses: 168900,
      netFlow: 573400,
      combinedBalance: 912050
    },
    generatedAt: new Date("2026-07-08T00:00:00Z")
  };
}
