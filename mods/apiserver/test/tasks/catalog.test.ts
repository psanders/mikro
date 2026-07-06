/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The automation catalog contract: registry closure, descriptor shape, gate
 * floors, and slot validation (including the schema-drift degrade path).
 */
import { expect } from "chai";
import {
  getAutomation,
  listAutomationIds,
  listAutomationDescriptors,
  gateRespectsFloor
} from "../../src/tasks/catalog.js";
import { validateSlots, slotNames } from "../../src/tasks/validatePayload.js";

describe("automation catalog", () => {
  it("ships exactly the three v1 automations", () => {
    expect(listAutomationIds().sort()).to.deep.equal([
      "daily-close",
      "pay-collector",
      "record-expense"
    ]);
  });

  it("returns undefined for an unknown automation", () => {
    expect(getAutomation("send-crypto")).to.equal(undefined);
  });

  it("every v1 automation declares a confirm floor", () => {
    for (const d of listAutomationDescriptors()) {
      expect(d.gateFloor, d.id).to.equal("confirm");
    }
  });

  it("descriptors expose slot names, labels, sources, and kinds", () => {
    const pay = listAutomationDescriptors().find((d) => d.id === "pay-collector");
    expect(pay).to.not.equal(undefined);
    const amount = pay!.slots.find((s) => s.name === "amount");
    expect(amount).to.deep.equal({
      name: "amount",
      label: "Monto (RD$)",
      source: "ask",
      kind: "amount",
      optional: false
    });
  });

  it("gateRespectsFloor never allows loosening below confirm", () => {
    expect(gateRespectsFloor("confirm", "confirm")).to.equal(true);
    expect(gateRespectsFloor("auto", "confirm")).to.equal(false);
    expect(gateRespectsFloor("auto", "auto")).to.equal(true);
    expect(gateRespectsFloor("confirm", "auto")).to.equal(true);
  });
});

describe("validateSlots", () => {
  const payCollector = getAutomation("pay-collector")!;

  it("accepts valid static values and reports none missing", () => {
    const result = validateSlots(
      payCollector,
      {
        collectorId: "0d4bb054-8b4c-4c53-9241-7b3a37dbfb2e",
        accountId: "1d4bb054-8b4c-4c53-9241-7b3a37dbfb2e",
        categoryId: "2d4bb054-8b4c-4c53-9241-7b3a37dbfb2e"
      },
      ["static"]
    );
    expect(result.missing).to.deep.equal([]);
    expect(Object.keys(result.values).sort()).to.deep.equal([
      "accountId",
      "categoryId",
      "collectorId"
    ]);
  });

  it("flags a schema-invalid value as missing (no side effect possible)", () => {
    const result = validateSlots(payCollector, { amount: -50 }, ["ask"]);
    expect(result.missing).to.include("amount");
    expect(result.values).to.not.have.property("amount");
  });

  it("coerces ask amounts from form strings", () => {
    const result = validateSlots(payCollector, { amount: "3500" }, ["ask"]);
    expect(result.missing).to.deep.equal([]);
    expect(result.values.amount).to.equal(3500);
  });

  it("lets optional ask slots be absent", () => {
    const result = validateSlots(payCollector, { amount: 3500 }, ["ask"]);
    expect(result.missing).to.deep.equal([]);
  });

  it("reports required slots missing when values are absent (drift degrade path)", () => {
    const result = validateSlots(payCollector, {}, ["static", "ask"]);
    expect(result.missing).to.include.members(["collectorId", "accountId", "amount"]);
  });

  it("slotNames partitions by source", () => {
    expect(slotNames(payCollector, "ask").sort()).to.deep.equal(["amount", "note"]);
    expect(slotNames(getAutomation("daily-close")!, "computed")).to.deep.equal(["closeDate"]);
  });
});
