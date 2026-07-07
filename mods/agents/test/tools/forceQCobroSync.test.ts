/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Unit tests for the founder-copilot on-demand QCobro sync executor handler
 * (mikro/#130). It orchestrates the injected dependency only — no sync logic
 * of its own — and reads the actor's display name from context.name for feed
 * attribution.
 */
import { expect } from "chai";
import sinon from "sinon";
import { handleForceQCobroSync } from "../../src/tools/executor/forceQCobroSync.js";
import type { ToolExecutorDependencies } from "../../src/tools/executor/types.js";

const CTX = { userId: "founder-1", role: "ADMIN", name: "Ana" };

function deps(over: Partial<ToolExecutorDependencies>): ToolExecutorDependencies {
  return over as unknown as ToolExecutorDependencies;
}

describe("handleForceQCobroSync", () => {
  afterEach(() => sinon.restore());

  it("runs the sync and passes context.name as the actor", async () => {
    const stub = sinon.stub().resolves({
      customers: 12,
      portfoliosPushed: 3,
      portfoliosSkipped: 1,
      durationMs: 456
    });
    const result = await handleForceQCobroSync(deps({ forceQCobroSync: stub }), {}, CTX);

    expect(result.success).to.be.true;
    expect(stub.calledOnceWith("Ana")).to.be.true;
    expect(result.message).to.match(/12 clientes/);
    expect(result.data).to.deep.equal({
      customers: 12,
      portfoliosPushed: 3,
      portfoliosSkipped: 1,
      durationMs: 456
    });
  });

  it("fails when the dependency is not configured", async () => {
    const result = await handleForceQCobroSync(deps({}), {}, CTX);
    expect(result.success).to.be.false;
  });

  it("still runs without an actor name in context", async () => {
    const stub = sinon
      .stub()
      .resolves({ customers: 0, portfoliosPushed: 0, portfoliosSkipped: 0, durationMs: 1 });
    const result = await handleForceQCobroSync(deps({ forceQCobroSync: stub }), {}, {});
    expect(result.success).to.be.true;
    expect(stub.calledOnceWith(undefined)).to.be.true;
  });
});
