/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The catalog summary rendered into createTask's tool description. Optional
 * static slots must read as optional so the model omits them instead of
 * inventing a value — previously only `suggestedAmount` did, and only because
 * its Spanish label happens to end in "opcional", while `employeeId` (optional
 * since #163) read as required.
 */
import { expect } from "chai";
import { createTaskTool } from "../../src/api/copilot/toolPolicy.js";

/** The `- payment ("Pago"): parámetros fijos: …` line of the catalog block. */
function catalogLine(automationId: string): string {
  const line = (createTaskTool.function.description ?? "")
    .split("\n")
    .find((l) => l.startsWith(`- ${automationId} `));
  expect(line, `catalog line for ${automationId}`).to.not.equal(undefined);
  return line!;
}

describe("createTask automation catalog doc", () => {
  it("marks payment's optional static slots optional and leaves required ones unmarked", () => {
    const line = catalogLine("payment");

    expect(line, "employeeId marked optional").to.match(/employeeId \(Empleado, opcional\)/);
    expect(line, "accountId not marked optional").to.match(/accountId \(Cuenta\)/);
    expect(line, "categoryId not marked optional").to.match(/categoryId \(Categoría\)/);
  });

  it("does not say opcional twice when the slot's own label already says it", () => {
    const line = catalogLine("payment");
    const suggested = line.match(/suggestedAmount \(([^)]*\)?[^)]*)\)/)?.[0] ?? "";

    expect(suggested, "suggestedAmount present").to.not.equal("");
    expect(
      suggested.toLowerCase().split("opcional").length - 1,
      `"opcional" occurrences in ${suggested}`
    ).to.equal(1);
  });

  it("still lists the ask slots separately from the static ones", () => {
    const line = catalogLine("payment");

    expect(line).to.include("Se pregunta al confirmar:");
    expect(line).to.include("Monto (RD$)");
  });

  it("marks record-expense's required static slots as required", () => {
    const line = catalogLine("record-expense");

    expect(line).to.match(/concept \(Concepto\)/);
    expect(line).to.not.match(/concept \([^)]*opcional/);
  });
});
