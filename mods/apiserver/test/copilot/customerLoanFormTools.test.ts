/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The copilot's customer/loan form entry points: openCustomerForm and
 * openLoanForm are bound as DIRECT tools (open the form, create nothing), and
 * createCustomer/createLoan remain reachable as WRITE tools (confirm-card
 * fallback) — not removed, just steered away from by the system prompt.
 */
import { expect } from "chai";
import {
  getBoundToolNames,
  isDirectTool,
  isReadTool,
  isWriteTool
} from "../../src/api/copilot/toolPolicy.js";

describe("openCustomerForm / openLoanForm tool policy", () => {
  it("binds both as direct (no-confirm) tools", () => {
    for (const name of ["openCustomerForm", "openLoanForm"]) {
      expect(getBoundToolNames(), `${name} bound`).to.include(name);
      expect(isDirectTool(name), `${name} isDirectTool`).to.be.true;
      expect(isWriteTool(name), `${name} isWriteTool`).to.be.false;
      expect(isReadTool(name), `${name} isReadTool`).to.be.false;
    }
  });

  it("keeps createCustomer/createLoan bound as write tools (confirm-card fallback)", () => {
    expect(isWriteTool("createCustomer")).to.be.true;
    expect(isWriteTool("createLoan")).to.be.true;
    expect(getBoundToolNames()).to.include("createCustomer");
    expect(getBoundToolNames()).to.include("createLoan");
  });

  it("no longer binds the retired openContractForm tool", () => {
    expect(getBoundToolNames()).to.not.include("openContractForm");
  });
});
