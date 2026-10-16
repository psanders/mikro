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

  it("describes phones without a schema pattern (the server validates formats)", () => {
    for (const key of ["phone", "businessPhone", "referencePhone", "spousePhone"]) {
      expect(fields[key].pattern, key).to.equal(undefined);
      expect(fields[key].description, key).to.contain("809, 829 u 849");
    }
  });

  it('lets optional contact phones be declined with "no tiene"', () => {
    for (const key of ["businessPhone", "referencePhone", "spousePhone"]) {
      expect(fields[key].description, key).to.contain("no tiene");
    }
  });
});
