/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The engine counts returned principal as revenue; computePnl must not.
 */
import { expect } from "chai";
import { runProjection, type ProjectionConfig } from "../../src/projection/engine.js";
import { computePnl } from "../../src/modelo/profitAndLoss.js";

const baseConfig: ProjectionConfig = {
  inversionInicial: 100000,
  gastosFijosMensuales: 17000,
  inversionMensual: 0,
  prestamoPromedio: 10000,
  tasaInteres: 0.3,
  frecuenciaPago: "SEMANAL",
  plazoBase: 10,
  prestamosPorSemana: 1,
  tasaMorosidad: 0.1,
  tasaDefault: 0.1,
  horizonteMeses: 12
};

describe("modelo/profitAndLoss", () => {
  it("counts only the interest share of a cuota as earnings", () => {
    const result = runProjection(baseConfig);
    const pnl = computePnl(result);
    const terms = result.summary.loanTerms;

    expect(pnl.interestShare).to.be.closeTo(terms.profitPerLoan / terms.actualTotal, 1e-9);
    for (const m of pnl.months) {
      expect(m.interestEarned + m.principalReturned).to.be.closeTo(m.collections, 1e-6);
      expect(m.interestEarned).to.be.lessThan(m.collections);
    }
  });

  it("reports a far lower result than the engine's gross-collections profit", () => {
    const result = runProjection(baseConfig);
    const pnl = computePnl(result);
    expect(pnl.cumulativeNet).to.be.lessThan(result.summary.cumulativeProfitAtHorizon);
    // A book placing 1 loan/week cannot carry 17k/month of fixed costs.
    expect(pnl.cumulativeNet).to.be.lessThan(0);
    expect(result.summary.cumulativeProfitAtHorizon).to.be.greaterThan(0);
  });

  it("subtracts fixed costs and default losses from earned interest", () => {
    const pnl = computePnl(runProjection(baseConfig));
    for (const m of pnl.months) {
      expect(m.net).to.be.closeTo(
        m.interestEarned + m.moraIncome - m.fixedCosts - m.defaultLosses,
        1e-6
      );
    }
  });

  it("accumulates monthly results and flags operating breakeven only when a month pays for itself", () => {
    const pnl = computePnl(runProjection(baseConfig));
    let running = 0;
    for (const m of pnl.months) {
      running += m.net;
      expect(m.cumulativeNet).to.be.closeTo(running, 1e-6);
    }
    expect(pnl.cumulativeNet).to.be.closeTo(running, 1e-6);
    if (pnl.operatingBreakevenMonth !== null) {
      const month = pnl.months.find((m) => m.month === pnl.operatingBreakevenMonth);
      expect(month?.net).to.be.greaterThan(0);
    }
  });

  it("turns profitable at enough volume, where the engine's own min-loans math says it should", () => {
    const result = runProjection(baseConfig);
    const needed = result.summary.minLoansPerWeekForBreakeven;
    const scaled = computePnl(runProjection({ ...baseConfig, prestamosPorSemana: needed }));
    expect(scaled.matureMonthlyNet).to.be.greaterThan(0);
  });
});
