/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The copilot's on-demand conversation audit (openspec add-conversation-audit):
 * runs the injected audit with the founder as actor and relays the counts; a
 * run already in progress comes back as a failed result, not a throw.
 */
import { expect } from "chai";
import sinon from "sinon";
import { handleRunConversationAudit } from "../../src/tools/executor/runConversationAudit.js";
import type { ToolExecutorDependencies } from "../../src/tools/executor/types.js";

const CTX = { userId: "founder-1", role: "ADMIN", name: "Pedro S." };

function deps(over: Partial<ToolExecutorDependencies>): ToolExecutorDependencies {
  return over as unknown as ToolExecutorDependencies;
}

describe("handleRunConversationAudit", () => {
  afterEach(() => sinon.restore());

  it("runs the audit as the founder and reports the counts", async () => {
    const stub = sinon.stub().resolves({
      runId: "run-1",
      conversations: 12,
      handoffs: 1,
      criticalCount: 0,
      warningCount: 0
    });
    const result = await handleRunConversationAudit(deps({ runConversationAudit: stub }), {}, CTX);
    expect(stub.calledOnceWith("Pedro S.")).to.be.true;
    expect(result.success).to.be.true;
    expect(result.message).to.contain("revisé 12 conversaciones y no encontré problemas");
    expect(result.message).to.contain("1 pasaron a persona");
  });

  it("reports critical and warning counts", async () => {
    const stub = sinon.stub().resolves({
      runId: "run-2",
      conversations: 42,
      handoffs: 4,
      criticalCount: 1,
      warningCount: 2
    });
    const result = await handleRunConversationAudit(deps({ runConversationAudit: stub }), {}, CTX);
    expect(result.message).to.contain("1 crítico(s) y 2 advertencia(s)");
  });

  it("relays an audit already in progress as a failed result", async () => {
    const stub = sinon
      .stub()
      .rejects(new Error("Ya hay una auditoría de conversaciones en curso."));
    const result = await handleRunConversationAudit(deps({ runConversationAudit: stub }), {}, CTX);
    expect(result.success).to.be.false;
    expect(result.message).to.contain("en curso");
  });

  it("fails when the dependency is not configured", async () => {
    const result = await handleRunConversationAudit(deps({}), {}, CTX);
    expect(result.success).to.be.false;
  });
});
