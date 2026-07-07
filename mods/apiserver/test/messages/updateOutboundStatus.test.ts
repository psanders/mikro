/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createUpdateOutboundStatus } from "../../src/api/messages/updateOutboundStatus.js";
import type { WhatsAppStatus } from "@mikro/common";

const status = (over: Partial<WhatsAppStatus>): WhatsAppStatus => ({
  id: "wamid.ABC",
  status: "delivered",
  timestamp: "1700000000",
  ...over
});

describe("createUpdateOutboundStatus", () => {
  afterEach(() => sinon.restore());

  it("updates the row forward (accepted → delivered)", async () => {
    const update = sinon.stub().resolves();
    const db = {
      outboundMessage: {
        findUnique: sinon.stub().resolves({ waMessageId: "wamid.ABC", status: "accepted" }),
        update
      }
    };
    await createUpdateOutboundStatus(db as any)(status({ status: "delivered" }));
    expect(update.calledOnce).to.equal(true);
    expect(update.firstCall.args[0].data.status).to.equal("delivered");
  });

  it("ignores a status for an untracked message (no row)", async () => {
    const update = sinon.stub().resolves();
    const db = {
      outboundMessage: { findUnique: sinon.stub().resolves(null), update }
    };
    await createUpdateOutboundStatus(db as any)(status({ status: "read" }));
    expect(update.called).to.equal(false);
  });

  it("does not downgrade (read → delivered is ignored)", async () => {
    const update = sinon.stub().resolves();
    const db = {
      outboundMessage: {
        findUnique: sinon.stub().resolves({ waMessageId: "wamid.ABC", status: "read" }),
        update
      }
    };
    await createUpdateOutboundStatus(db as any)(status({ status: "delivered" }));
    expect(update.called).to.equal(false);
  });

  it("records the error code/title on a failed status", async () => {
    const update = sinon.stub().resolves();
    const db = {
      outboundMessage: {
        findUnique: sinon.stub().resolves({ waMessageId: "wamid.ABC", status: "sent" }),
        update
      }
    };
    await createUpdateOutboundStatus(db as any)(
      status({ status: "failed", errors: [{ code: 131047, title: "Re-engagement message" }] })
    );
    expect(update.calledOnce).to.equal(true);
    expect(update.firstCall.args[0].data.status).to.equal("failed");
    expect(update.firstCall.args[0].data.errorCode).to.equal(131047);
    expect(update.firstCall.args[0].data.errorTitle).to.equal("Re-engagement message");
  });

  it("keeps a failed row failed (no override by a late progress status)", async () => {
    const update = sinon.stub().resolves();
    const db = {
      outboundMessage: {
        findUnique: sinon.stub().resolves({ waMessageId: "wamid.ABC", status: "failed" }),
        update
      }
    };
    await createUpdateOutboundStatus(db as any)(status({ status: "delivered" }));
    expect(update.called).to.equal(false);
  });
});
