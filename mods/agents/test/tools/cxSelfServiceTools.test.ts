/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The WhatsApp CX self-service tools (openspec cx-role-based-agents) are thin
 * dispatches: the executor hands the conversation context through untouched,
 * so the apiserver implementation can take identity from it rather than from
 * the model's arguments.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createToolExecutor } from "../../src/tools/executor/index.js";
import type { ToolExecutorDependencies } from "../../src/tools/executor/types.js";
import { getToolByName } from "../../src/tools/definitions.js";

const CTX = { phone: "+18095550001", customerId: "cust-1", profile: "CUSTOMER" };
const CX_TOOLS = [
  "listMyLoans",
  "listMyPayments",
  "sendMyReceipt",
  "getMyApplicationStatus",
  "attachApplicationEvidence",
  "requestHumanHandoff"
] as const;

describe("CX self-service tools", () => {
  afterEach(() => sinon.restore());

  it("defines every CX tool", () => {
    for (const name of CX_TOOLS) expect(getToolByName(name), name).to.not.equal(undefined);
  });

  it("passes the conversation context through to the implementation", async () => {
    const ok = { success: true, message: "ok" };
    const cx = {
      listMyLoans: sinon.stub().resolves(ok),
      listMyPayments: sinon.stub().resolves(ok),
      sendMyReceipt: sinon.stub().resolves(ok),
      getMyApplicationStatus: sinon.stub().resolves(ok),
      attachApplicationEvidence: sinon.stub().resolves(ok),
      requestHumanHandoff: sinon.stub().resolves(ok)
    };
    const execute = createToolExecutor({ cx } as unknown as ToolExecutorDependencies);

    await execute("listMyLoans", { customerId: "other" }, CTX);
    await execute("sendMyReceipt", { paymentId: "p-1" }, CTX);

    expect(cx.listMyLoans.calledOnceWith(CTX)).to.be.true;
    expect(cx.sendMyReceipt.calledOnceWith({ paymentId: "p-1" }, CTX)).to.be.true;
  });

  it("reports not configured when the apiserver did not wire them", async () => {
    const execute = createToolExecutor({} as unknown as ToolExecutorDependencies);
    const result = await execute("requestHumanHandoff", { reason: "x" }, CTX);
    expect(result.success).to.be.false;
  });
});
