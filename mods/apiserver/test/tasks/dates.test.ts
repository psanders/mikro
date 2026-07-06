/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Schedule math in America/Santo_Domingo (fixed UTC-4): next-fire computation
 * per frequency, month-end clamping, and the once-in-the-past case.
 */
import { expect } from "chai";
import { computeNextFireAt, localDateString, localDayRange } from "../../src/tasks/dates.js";
import type { ScheduleFields } from "../../src/tasks/dates.js";

function schedule(partial: Partial<ScheduleFields>): ScheduleFields {
  return {
    frequency: "daily",
    weekday: null,
    dayOfMonth: null,
    onDate: null,
    timeOfDay: "08:00",
    ...partial
  };
}

describe("computeNextFireAt", () => {
  // Reference: 2026-07-06 is a Monday. 12:00Z = 08:00 in Santo Domingo.

  it("daily: fires today when the time is still ahead", () => {
    const after = new Date("2026-07-06T11:00:00Z"); // 07:00 local
    const next = computeNextFireAt(schedule({ frequency: "daily" }), after);
    expect(next!.toISOString()).to.equal("2026-07-06T12:00:00.000Z");
  });

  it("daily: rolls to tomorrow once the time passed", () => {
    const after = new Date("2026-07-06T12:00:00Z"); // exactly 08:00 local
    const next = computeNextFireAt(schedule({ frequency: "daily" }), after);
    expect(next!.toISOString()).to.equal("2026-07-07T12:00:00.000Z");
  });

  it("weekly: finds the next Friday from a Monday", () => {
    const after = new Date("2026-07-06T12:00:00Z"); // Monday 08:00 local
    const next = computeNextFireAt(schedule({ frequency: "weekly", weekday: 5 }), after);
    expect(next!.toISOString()).to.equal("2026-07-10T12:00:00.000Z"); // Friday
  });

  it("weekly: same weekday with the time passed jumps a full week", () => {
    const after = new Date("2026-07-10T12:30:00Z"); // Friday 08:30 local
    const next = computeNextFireAt(schedule({ frequency: "weekly", weekday: 5 }), after);
    expect(next!.toISOString()).to.equal("2026-07-17T12:00:00.000Z");
  });

  it("monthly: clamps day 31 to a 30-day month", () => {
    const after = new Date("2026-09-05T00:00:00Z");
    const next = computeNextFireAt(schedule({ frequency: "monthly", dayOfMonth: 31 }), after);
    // September has 30 days → clamped to the 30th, 08:00 local = 12:00Z.
    expect(next!.toISOString()).to.equal("2026-09-30T12:00:00.000Z");
  });

  it("monthly: rolls into the next month (and year) when the day passed", () => {
    const after = new Date("2026-12-31T13:00:00Z"); // Dec 31, 09:00 local
    const next = computeNextFireAt(schedule({ frequency: "monthly", dayOfMonth: 31 }), after);
    expect(next!.toISOString()).to.equal("2027-01-31T12:00:00.000Z");
  });

  it("once: returns the moment when it is still ahead, null when passed", () => {
    const fields = schedule({ frequency: "once", onDate: "2026-07-10" });
    expect(computeNextFireAt(fields, new Date("2026-07-06T00:00:00Z"))!.toISOString()).to.equal(
      "2026-07-10T12:00:00.000Z"
    );
    expect(computeNextFireAt(fields, new Date("2026-07-11T00:00:00Z"))).to.equal(null);
  });
});

describe("local date helpers", () => {
  it("localDateString uses Santo Domingo wall-clock, not UTC", () => {
    // 03:30Z on the 6th is still 23:30 on the 5th in Santo Domingo.
    expect(localDateString(new Date("2026-07-06T03:30:00Z"))).to.equal("2026-07-05");
  });

  it("localDayRange spans exactly the local calendar day", () => {
    const { start, end } = localDayRange("2026-07-05");
    expect(start.toISOString()).to.equal("2026-07-05T04:00:00.000Z");
    expect(end.toISOString()).to.equal("2026-07-06T04:00:00.000Z");
  });
});
