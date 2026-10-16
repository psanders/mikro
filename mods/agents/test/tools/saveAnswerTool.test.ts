/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { MARITAL_STATUSES } from "@mikro/common";
import { saveAnswerTool } from "../../src/tools/definitions.js";

describe("saveAnswer tool schema", () => {
  const fields = saveAnswerTool.function.parameters.properties.fields.properties!;

  it("offers marital status as the enum of codes", () => {
    expect(fields.maritalStatus.enum).to.deep.equal([...MARITAL_STATUSES]);
  });

  it("constrains every phone to a 10-digit Dominican number", () => {
    for (const key of ["phone", "businessPhone", "referencePhone", "spousePhone"]) {
      const pattern = new RegExp(fields[key].pattern!);
      expect(pattern.test("8095551234"), key).to.equal(true);
      expect(pattern.test("0000000000"), key).to.equal(false);
    }
  });
});
