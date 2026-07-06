/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Unit tests for the founder-copilot application-review executor handlers
 * (approve / reject / delete). They read the reviewer id from context.userId,
 * guard for a missing dependency or missing reviewer, and require a reason to
 * reject.
 */
import { expect } from "chai";
import sinon from "sinon";
import { handleApproveApplication } from "../../src/tools/executor/approveApplication.js";
import { handleRejectApplication } from "../../src/tools/executor/rejectApplication.js";
import { handleDeleteApplication } from "../../src/tools/executor/deleteApplication.js";
import type { ToolExecutorDependencies } from "../../src/tools/executor/types.js";

const CTX = { userId: "founder-1", role: "ADMIN", name: "Ana" };

function deps(over: Partial<ToolExecutorDependencies>): ToolExecutorDependencies {
  return over as unknown as ToolExecutorDependencies;
}

describe("handleApproveApplication", () => {
  afterEach(() => sinon.restore());

  it("approves and passes context.userId as the reviewer", async () => {
    const stub = sinon.stub().resolves({ id: "app-1", status: "APPROVED" });
    const result = await handleApproveApplication(
      deps({ approveApplication: stub }),
      { id: "app-1", note: "ok" },
      CTX
    );
    expect(result.success).to.be.true;
    expect(stub.calledOnceWith({ id: "app-1", note: "ok" }, "founder-1")).to.be.true;
    expect((result.data as { status: string }).status).to.equal("APPROVED");
  });

  it("fails when the dependency is not configured", async () => {
    const result = await handleApproveApplication(deps({}), { id: "app-1" }, CTX);
    expect(result.success).to.be.false;
  });

  it("fails when no reviewer id is in context", async () => {
    const stub = sinon.stub().resolves({ id: "app-1", status: "APPROVED" });
    const result = await handleApproveApplication(
      deps({ approveApplication: stub }),
      { id: "app-1" },
      {}
    );
    expect(result.success).to.be.false;
    expect(stub.called).to.be.false;
  });
});

describe("handleRejectApplication", () => {
  afterEach(() => sinon.restore());

  it("rejects with a reason and stores it in the message", async () => {
    const stub = sinon.stub().resolves({ id: "app-2", status: "REJECTED" });
    const result = await handleRejectApplication(
      deps({ rejectApplication: stub }),
      { id: "app-2", reason: "Capacidad de pago insuficiente" },
      CTX
    );
    expect(result.success).to.be.true;
    expect(
      stub.calledOnceWith({ id: "app-2", reason: "Capacidad de pago insuficiente" }, "founder-1")
    ).to.be.true;
    expect(result.message).to.match(/Capacidad de pago insuficiente/);
  });

  it("refuses to reject without a non-empty reason", async () => {
    const stub = sinon.stub().resolves({ id: "app-2", status: "REJECTED" });
    const result = await handleRejectApplication(
      deps({ rejectApplication: stub }),
      { id: "app-2", reason: "   " },
      CTX
    );
    expect(result.success).to.be.false;
    expect(stub.called).to.be.false;
    expect(result.message).to.match(/motivo/i);
  });
});

describe("handleDeleteApplication", () => {
  afterEach(() => sinon.restore());

  it("deletes and passes the reviewer id", async () => {
    const stub = sinon.stub().resolves({ id: "app-3", status: "ABANDONED" });
    const result = await handleDeleteApplication(
      deps({ deleteApplication: stub }),
      { id: "app-3" },
      CTX
    );
    expect(result.success).to.be.true;
    expect(stub.calledOnceWith({ id: "app-3" }, "founder-1")).to.be.true;
  });

  it("fails when the dependency is not configured", async () => {
    const result = await handleDeleteApplication(deps({}), { id: "app-3" }, CTX);
    expect(result.success).to.be.false;
  });
});
