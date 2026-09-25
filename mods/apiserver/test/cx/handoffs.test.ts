/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import {
  HANDOFF_TTL_MS,
  createOpenHandoff,
  createExtendHandoff,
  createGetOpenHandoffExpiry
} from "../../src/api/cx/handoffs.js";

const HANDOFF_ID = "7d4a1a52-5f6e-4f5a-9d5c-0b7a3f2e9c11";

function makeDb(openCount: number) {
  const tx = {
    conversationHandoff: {
      updateMany: sinon.stub().resolves({ count: openCount }),
      create: sinon.stub().resolves({ id: HANDOFF_ID })
    },
    businessEvent: { create: sinon.stub().resolves({ id: "evt-1" }) }
  };
  const db = {
    ...tx,
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)
  };
  return { db: db as any, tx };
}

describe("human hand-offs", () => {
  afterEach(() => sinon.restore());

  it("opens a hand-off with a 24h expiry and records the feed event", async () => {
    const { db, tx } = makeDb(0);
    const before = Date.now();

    const result = await createOpenHandoff(db)({
      phone: "+18095550001",
      profile: "CUSTOMER",
      reason: "quiere hablar con una persona",
      displayName: "Ana López"
    });

    expect(result).to.deep.equal({ opened: true });
    const data = tx.conversationHandoff.create.firstCall.args[0].data;
    expect(data.phone).to.equal("+18095550001");
    expect(data.expiresAt.getTime()).to.be.at.least(before + HANDOFF_TTL_MS);
    const event = tx.businessEvent.create.firstCall.args[0].data;
    expect(event.type).to.equal("cx.handoff_requested");
    expect(JSON.parse(event.payload)).to.deep.equal({
      handoffId: HANDOFF_ID,
      phone: "+18095550001",
      profile: "CUSTOMER",
      reason: "quiere hablar con una persona"
    });
  });

  it("extends an already-open hand-off instead of creating a duplicate", async () => {
    const { db, tx } = makeDb(1);

    const result = await createOpenHandoff(db)({
      phone: "+18095550001",
      profile: "GUEST",
      reason: "otra vez"
    });

    expect(result).to.deep.equal({ opened: false });
    expect(tx.conversationHandoff.create.called).to.be.false;
    expect(tx.businessEvent.create.called).to.be.false;
  });

  it("only treats unclosed, unexpired rows as open", async () => {
    const findFirst = sinon.stub().resolves(null);
    const db = { conversationHandoff: { findFirst } } as any;

    expect(await createGetOpenHandoffExpiry(db)("+18095550001")).to.equal(null);
    const { where } = findFirst.firstCall.args[0];
    expect(where.phone).to.equal("+18095550001");
    expect(where.closedAt).to.equal(null);
    expect(where.expiresAt.gt).to.be.instanceOf(Date);
  });

  it("extend reports whether a hand-off was open", async () => {
    const updateMany = sinon.stub().resolves({ count: 0 });
    const db = { conversationHandoff: { updateMany } } as any;
    expect(await createExtendHandoff(db)("+18095550001")).to.be.false;
  });

  it("runs the follow-up (Chatwoot note) only for a NEW hand-off", async () => {
    const onOpened = sinon.stub().resolves();
    const input = { phone: "+18095550001", profile: "GUEST", reason: "x", summary: "s" };

    await createOpenHandoff(makeDb(0).db, onOpened)(input);
    await createOpenHandoff(makeDb(1).db, onOpened)(input);

    expect(onOpened.calledOnceWith(input)).to.be.true;
  });

  it("a failing follow-up does not fail the hand-off", async () => {
    const onOpened = sinon.stub().rejects(new Error("chatwoot down"));
    const result = await createOpenHandoff(
      makeDb(0).db,
      onOpened
    )({
      phone: "+18095550001",
      profile: "GUEST",
      reason: "x"
    });
    expect(result).to.deep.equal({ opened: true });
  });
});
