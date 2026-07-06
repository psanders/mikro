/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Founder task contracts: schedule-field requirements per frequency, gate
 * values, and the task.* business-event payload schemas.
 */
import { expect } from "chai";
import {
  createTaskSchema,
  updateTaskSchema,
  confirmTaskFiringSchema,
  businessEventPayloadSchemas
} from "../../src/schemas/index.js";

const base = {
  name: "Pago semanal — Luis M.",
  automationId: "pay-collector",
  timeOfDay: "08:00"
};

describe("createTaskSchema", () => {
  it("accepts a weekly schedule with a weekday", () => {
    const parsed = createTaskSchema.safeParse({ ...base, frequency: "weekly", weekday: 5 });
    expect(parsed.success).to.equal(true);
    if (parsed.success) {
      expect(parsed.data.staticParams).to.deep.equal({});
      expect(parsed.data.gate).to.equal(undefined);
    }
  });

  it("rejects weekly without weekday", () => {
    const parsed = createTaskSchema.safeParse({ ...base, frequency: "weekly" });
    expect(parsed.success).to.equal(false);
  });

  it("rejects monthly without dayOfMonth", () => {
    const parsed = createTaskSchema.safeParse({ ...base, frequency: "monthly" });
    expect(parsed.success).to.equal(false);
  });

  it("rejects once without onDate", () => {
    const parsed = createTaskSchema.safeParse({ ...base, frequency: "once" });
    expect(parsed.success).to.equal(false);
  });

  it("accepts daily without extra schedule fields", () => {
    const parsed = createTaskSchema.safeParse({ ...base, frequency: "daily" });
    expect(parsed.success).to.equal(true);
  });

  it("rejects a malformed timeOfDay", () => {
    const parsed = createTaskSchema.safeParse({
      ...base,
      frequency: "daily",
      timeOfDay: "8am"
    });
    expect(parsed.success).to.equal(false);
  });

  it("rejects an unknown gate value", () => {
    const parsed = createTaskSchema.safeParse({
      ...base,
      frequency: "daily",
      gate: "never"
    });
    expect(parsed.success).to.equal(false);
  });
});

describe("updateTaskSchema", () => {
  it("re-requires schedule fields when frequency changes", () => {
    const parsed = updateTaskSchema.safeParse({
      id: "0d4bb054-8b4c-4c53-9241-7b3a37dbfb2e",
      frequency: "monthly"
    });
    expect(parsed.success).to.equal(false);
  });

  it("allows a partial update that leaves the schedule alone", () => {
    const parsed = updateTaskSchema.safeParse({
      id: "0d4bb054-8b4c-4c53-9241-7b3a37dbfb2e",
      name: "Pago semanal — Marta R."
    });
    expect(parsed.success).to.equal(true);
  });
});

describe("confirmTaskFiringSchema", () => {
  it("defaults askValues to an empty record", () => {
    const parsed = confirmTaskFiringSchema.safeParse({
      id: "0d4bb054-8b4c-4c53-9241-7b3a37dbfb2e"
    });
    expect(parsed.success).to.equal(true);
    if (parsed.success) expect(parsed.data.askValues).to.deep.equal({});
  });
});

describe("task.* business-event payloads", () => {
  const firing = {
    taskFiringId: "0d4bb054-8b4c-4c53-9241-7b3a37dbfb2e",
    automationId: "pay-collector",
    taskName: "Pago semanal — Luis M."
  };

  it("task.due requires the intended dueAt", () => {
    const schema = businessEventPayloadSchemas["task.due"];
    expect(schema.safeParse({ ...firing, dueAt: "2026-07-10T12:00:00Z" }).success).to.equal(true);
    expect(schema.safeParse(firing).success).to.equal(false);
  });

  it("task.needs_input requires at least one missing slot", () => {
    const schema = businessEventPayloadSchemas["task.needs_input"];
    expect(schema.safeParse({ ...firing, missingSlots: ["amount"] }).success).to.equal(true);
    expect(schema.safeParse({ ...firing, missingSlots: [] }).success).to.equal(false);
  });

  it("task.completed carries the skipped discriminant", () => {
    const schema = businessEventPayloadSchemas["task.completed"];
    expect(schema.safeParse({ ...firing, skipped: false }).success).to.equal(true);
    expect(schema.safeParse(firing).success).to.equal(false);
  });

  it("task.failed requires a reason", () => {
    const schema = businessEventPayloadSchemas["task.failed"];
    expect(schema.safeParse({ ...firing, reason: "cuenta inactiva" }).success).to.equal(true);
    expect(schema.safeParse({ ...firing, reason: "" }).success).to.equal(false);
  });
});
