/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Slot-value validation against an automation's current param spec. Called at
 * task create/edit (static slots), at fire time (assembled payload), and at
 * confirm (ask values) — so an automation updated between fire and confirm
 * degrades to NEEDS_INPUT instead of executing with a stale payload.
 */
import type { TaskSlotSource } from "@mikro/common";
import type { Automation } from "./types.js";

export interface SlotValidationResult {
  /** Values that parsed, keyed by slot name (parsed output, e.g. coerced numbers). */
  values: Record<string, unknown>;
  /** Slot names that are missing or failed their schema. */
  missing: string[];
}

/**
 * Validate `values` for every slot of `automation` with a source in
 * `sources`. Optional slots may be absent; required ones land in `missing`.
 */
export function validateSlots(
  automation: Automation,
  values: Record<string, unknown>,
  sources: readonly TaskSlotSource[]
): SlotValidationResult {
  const out: Record<string, unknown> = {};
  const missing: string[] = [];

  for (const [name, spec] of Object.entries(automation.params)) {
    if (!sources.includes(spec.source)) continue;

    const raw = values[name];
    if (raw === undefined || raw === null || raw === "") {
      if (!spec.optional) missing.push(name);
      continue;
    }

    const parsed = spec.schema.safeParse(raw);
    if (parsed.success) {
      out[name] = parsed.data;
    } else {
      missing.push(name);
    }
  }

  return { values: out, missing };
}

/** Names of the automation's slots with the given source. */
export function slotNames(automation: Automation, source: TaskSlotSource): string[] {
  return Object.entries(automation.params)
    .filter(([, spec]) => spec.source === source)
    .map(([name]) => name);
}
