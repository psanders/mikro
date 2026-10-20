/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { summaryHeaderLine } from "../../src/contracts/summaryGenerator.js";

const base = {
  id: "3f9c1a2b-0000-4000-8000-000000000000",
  createdAt: new Date("2026-10-19T15:00:00.000Z"),
  status: "IN_REVIEW"
};

describe("application PDF header line", () => {
  it("shows id, date, readable status and the origin", () => {
    const line = summaryHeaderLine({ ...base, origin: "organic" });
    expect(line).to.match(
      /^#3F9C1A2B {4}· {4}.+ {4}· {4}En evaluación {4}· {4}Formulario \(orgánico\)$/
    );
  });

  it("leaves the origin out when it isn't known", () => {
    expect(summaryHeaderLine(base)).to.match(/En evaluación$/);
  });
});
