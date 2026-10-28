/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The loan screen's cuota dates come from the shared `@mikro/common` due-date
 * function, fed the synced row's raw `first_due_date` (mikro/#386).
 */
import { getLoanDueDate } from "@mikro/common/utils/dueDates";
import { loanDueDateFields } from "../loanDueDates";

function schedule(fields: ReturnType<typeof loanDueDateFields>, count: number): string[] {
  if (!fields) throw new Error("expected due-date fields");
  return Array.from({ length: count }, (_, i) =>
    getLoanDueDate(fields, i).toISOString().slice(0, 10)
  );
}

const QUINCENAL = ["2026-10-15", "2026-10-31", "2026-11-15", "2026-11-30", "2026-12-15"];

describe("loanDueDateFields", () => {
  it("dates a synced BIWEEKLY loan from its firstDueDate on the 15th and month-end", () => {
    const fields = loanDueDateFields({
      firstDueDate: "2026-10-15T00:00:00.000Z",
      startingDate: "2026-10-01T00:00:00.000Z",
      createdAt: "2026-10-01T12:00:00.000Z",
      paymentFrequency: "BIWEEKLY"
    });
    expect(schedule(fields, 5)).toEqual(QUINCENAL);
  });

  it("resolves the first cuota from startingDate when the server sent no firstDueDate", () => {
    const fields = loanDueDateFields({
      firstDueDate: null,
      startingDate: "2026-10-01T00:00:00.000Z",
      createdAt: "2026-10-01T12:00:00.000Z",
      paymentFrequency: "BIWEEKLY"
    });
    expect(schedule(fields, 5)).toEqual(QUINCENAL);
  });

  it("spaces WEEKLY cuotas 7 days from the first due, whatever day the customer prefers", () => {
    // 2026-10-14 is a Wednesday; a FRIDAY preference plays no part.
    const fields = loanDueDateFields({
      firstDueDate: "2026-10-14T00:00:00.000Z",
      startingDate: "2026-10-07T00:00:00.000Z",
      createdAt: "2026-10-07T12:00:00.000Z",
      paymentFrequency: "WEEKLY"
    });
    expect(schedule(fields, 3)).toEqual(["2026-10-14", "2026-10-21", "2026-10-28"]);
  });

  it("keeps a legacy MONTHLY loan on its anchor's day of month, matching the server", () => {
    const fields = loanDueDateFields({
      firstDueDate: null,
      startingDate: "2026-01-31T00:00:00.000Z",
      createdAt: "2026-01-31T12:00:00.000Z",
      paymentFrequency: "MONTHLY"
    });
    expect(schedule(fields, 3)).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("takes the raw firstDueDate from the row, never the snapshot's resolved one", () => {
    const fields = loanDueDateFields(
      {
        firstDueDate: null,
        startingDate: "2026-01-31T00:00:00.000Z",
        createdAt: "2026-01-31T12:00:00.000Z",
        paymentFrequency: "MONTHLY"
      },
      {
        startingDate: "2026-01-31T00:00:00.000Z",
        createdAt: "2026-01-31T12:00:00.000Z",
        paymentFrequency: "MONTHLY"
      }
    );
    expect(fields?.firstDueDate).toBeNull();
    expect(schedule(fields, 3)).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("has no dates until the loan row is loaded", () => {
    expect(loanDueDateFields(undefined)).toBeNull();
  });
});
