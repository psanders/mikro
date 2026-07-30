/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The observed collection rate has to reach the engine through `tasaDefault`,
 * because the engine has no partial-payment state.
 */
import { expect } from "chai";
import {
  assumedCollectionRate,
  collectionRateForPeriodDefault,
  defaultRateForCollectionRate,
  effectiveDefaultRate,
  minRepresentableCollectionRate
} from "../../src/modelo/collectionRate.js";

describe("modelo/collectionRate", () => {
  it("collects everything when nothing ever defaults", () => {
    expect(collectionRateForPeriodDefault(0, 10)).to.equal(1);
  });

  it("collects less as the per-period default probability rises", () => {
    const low = collectionRateForPeriodDefault(0.02, 10);
    const high = collectionRateForPeriodDefault(0.1, 10);
    expect(low).to.be.greaterThan(high);
    expect(low).to.be.lessThan(1);
    expect(high).to.be.greaterThan(0);
  });

  it("inverts the curve: the derived rate reproduces the target collection rate", () => {
    const term = 10;
    for (const target of [0.95, 0.85, 0.738, 0.62]) {
      const perPeriod = defaultRateForCollectionRate(target, term) / term;
      expect(collectionRateForPeriodDefault(perPeriod, term)).to.be.closeTo(target, 1e-6);
    }
  });

  it("saturates below the worst collection rate the engine can express", () => {
    const term = 10;
    const floor = minRepresentableCollectionRate(term);
    // tasaDefault is a share of loans, so it cannot exceed 1.
    expect(floor).to.be.closeTo(0.586, 0.001);
    expect(defaultRateForCollectionRate(floor, term)).to.be.closeTo(1, 1e-6);
    expect(defaultRateForCollectionRate(0.3, term)).to.equal(1);
  });

  it("needs no defaults to explain a book that collects everything", () => {
    expect(defaultRateForCollectionRate(1, 10)).to.equal(0);
  });

  it("blends the observed rate toward 100% as recovery rises", () => {
    expect(assumedCollectionRate(0.74, 0)).to.be.closeTo(0.74, 1e-9);
    expect(assumedCollectionRate(0.74, 1)).to.equal(1);
    expect(assumedCollectionRate(0.74, 0.5)).to.be.closeTo(0.87, 1e-9);
  });

  it("never reports less default than the loans already written off", () => {
    // Full recovery would imply zero derived default, but written-off principal
    // is lost regardless of how well collections improve.
    const rate = effectiveDefaultRate({
      collectionRate: 0.74,
      term: 10,
      recovery: 1,
      formalLossRate: 0.103
    });
    expect(rate).to.equal(0.103);
  });

  it("translates a 74% collection rate into a far higher default than the written-off share", () => {
    const rate = effectiveDefaultRate({
      collectionRate: 0.738,
      term: 10,
      recovery: 0,
      formalLossRate: 0.103
    });
    expect(rate).to.be.greaterThan(0.5);
    expect(rate).to.be.lessThan(0.6);
  });
});
