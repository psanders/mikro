/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The automation catalog: the closed set of automations a Task may bind.
 * There is deliberately no runtime registration surface — adding an
 * automation means shipping code (design D1).
 */
import type { TaskAutomationDescriptor, TaskGate } from "@mikro/common";
import type { Automation } from "./types.js";
import { payment } from "./automations/payment.js";
import { recordExpense } from "./automations/recordExpense.js";
import { dailyClose } from "./automations/dailyClose.js";
import { loanStatement } from "./automations/loanStatement.js";

const AUTOMATIONS: readonly Automation[] = [payment, recordExpense, dailyClose, loanStatement];

const byId = new Map(AUTOMATIONS.map((a) => [a.id, a]));

export function getAutomation(id: string): Automation | undefined {
  return byId.get(id);
}

export function listAutomationIds(): string[] {
  return AUTOMATIONS.map((a) => a.id);
}

/** Client-facing descriptors (Tasks tab form generation, copilot tool docs). */
export function listAutomationDescriptors(): TaskAutomationDescriptor[] {
  return AUTOMATIONS.map((a) => ({
    id: a.id,
    title: a.title,
    gateFloor: a.gateFloor,
    slots: Object.entries(a.params).map(([name, spec]) => ({
      name,
      label: spec.label,
      source: spec.source,
      kind: spec.kind,
      optional: spec.optional ?? false,
      defaultFrom: spec.defaultFrom
    }))
  }));
}

/** True when `gate` is at least as strict as the automation's floor. */
export function gateRespectsFloor(gate: TaskGate, floor: TaskGate): boolean {
  return floor === "auto" || gate === "confirm";
}
