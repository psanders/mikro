/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The copilot's contract entry point: openContractForm is bound as a DIRECT tool
 * (opens the form, generates nothing), and it is the ONLY contract-related tool
 * the model can call — there is no bound tool that renders or returns the PDF.
 */
import { expect } from "chai";
import {
  getBoundToolNames,
  isDirectTool,
  isReadTool,
  isWriteTool
} from "../../src/api/copilot/toolPolicy.js";

describe("openContractForm tool policy", () => {
  it("binds openContractForm as a direct (no-confirm) tool", () => {
    expect(getBoundToolNames()).to.include("openContractForm");
    expect(isDirectTool("openContractForm")).to.be.true;
    expect(isWriteTool("openContractForm")).to.be.false;
    expect(isReadTool("openContractForm")).to.be.false;
  });

  it("is the only contract-related tool bound to the model", () => {
    const contractTools = getBoundToolNames().filter((n) => /contract|contrato/i.test(n));
    expect(contractTools).to.deep.equal(["openContractForm"]);
  });

  it("never binds a tool that generates or returns a contract PDF", () => {
    const names = getBoundToolNames();
    expect(names).to.not.include("generateCustomerContract");
    expect(names).to.not.include("generateApplicationContract");
  });
});
