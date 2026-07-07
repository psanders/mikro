/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createMessageRouter } from "../../src/router/createMessageRouter.js";

const COLLECTOR_PHONE = "+18095550001";
const ADMIN_PHONE = "+18095550002";

const collectorUser = {
  id: "user-collector-1",
  name: "Pedro Collector",
  phone: COLLECTOR_PHONE,
  enabled: true,
  roles: [{ role: "COLLECTOR" as const }]
};

const adminUser = {
  id: "user-admin-1",
  name: "Pedro Admin",
  phone: ADMIN_PHONE,
  enabled: true,
  roles: [{ role: "ADMIN" as const }]
};

function makeDeps(overrides?: Partial<Parameters<typeof createMessageRouter>[0]>) {
  return {
    getUserByPhone: sinon.stub().resolves(null),
    getCustomerByPhone: sinon.stub().resolves(null),
    getAgentForProfile: sinon.stub().returns(undefined),
    ...overrides
  };
}

describe("createMessageRouter — COLLECTOR routing", () => {
  afterEach(() => sinon.restore());

  it("routes an enabled COLLECTOR to { type: 'user', role: 'COLLECTOR' } even with no agent assigned", async () => {
    const deps = makeDeps({
      getUserByPhone: sinon.stub().resolves(collectorUser),
      getAgentForProfile: sinon.stub().returns(undefined) // no agent in agents.yaml
    });
    const router = createMessageRouter(deps);
    const result = await router(COLLECTOR_PHONE);

    expect(result.type).to.equal("user");
    if (result.type === "user") {
      expect(result.role).to.equal("COLLECTOR");
      expect(result.userId).to.equal("user-collector-1");
    }
  });

  it("routes an enabled COLLECTOR with an agent assigned exactly the same way", async () => {
    const deps = makeDeps({
      getUserByPhone: sinon.stub().resolves(collectorUser),
      getAgentForProfile: sinon.stub().returns({
        name: "some-agent",
        profile: "COLLECTOR",
        enabled: true,
        systemPrompt: "x",
        allowedTools: [],
        temperature: 0,
        replyMode: "final" as const
      })
    });
    const router = createMessageRouter(deps);
    const result = await router(COLLECTOR_PHONE);

    expect(result.type).to.equal("user");
    if (result.type === "user") {
      expect(result.role).to.equal("COLLECTOR");
    }
  });

  it("still returns 'ignored' for a disabled COLLECTOR", async () => {
    const deps = makeDeps({
      getUserByPhone: sinon.stub().resolves({ ...collectorUser, enabled: false })
    });
    const router = createMessageRouter(deps);
    const result = await router(COLLECTOR_PHONE);

    expect(result.type).to.equal("ignored");
  });

  // mikro/#120: María was retired, so ADMIN with no agent assigned is now the
  // default (not a special case) — it routes as a user exactly like
  // COLLECTOR, and handleWhatsAppMessage decides to send a dashboard
  // redirect instead of silently ignoring.
  it("routes ADMIN to { type: 'user', role: 'ADMIN' } even with no agent assigned", async () => {
    const deps = makeDeps({
      getUserByPhone: sinon.stub().resolves(adminUser),
      getAgentForProfile: sinon.stub().returns(undefined)
    });
    const router = createMessageRouter(deps);
    const result = await router(ADMIN_PHONE);

    expect(result.type).to.equal("user");
    if (result.type === "user") {
      expect(result.role).to.equal("ADMIN");
      expect(result.userId).to.equal("user-admin-1");
    }
  });

  it("routes ADMIN with an assigned agent exactly the same way", async () => {
    const deps = makeDeps({
      getUserByPhone: sinon.stub().resolves(adminUser),
      getAgentForProfile: sinon.stub().returns({
        name: "custom-admin-bot",
        profile: "ADMIN",
        enabled: true,
        systemPrompt: "x",
        allowedTools: [],
        temperature: 0,
        replyMode: "final" as const
      })
    });
    const router = createMessageRouter(deps);
    const result = await router(ADMIN_PHONE);

    expect(result.type).to.equal("user");
    if (result.type === "user") {
      expect(result.role).to.equal("ADMIN");
    }
  });

  it("still returns 'ignored' for a disabled ADMIN", async () => {
    const deps = makeDeps({
      getUserByPhone: sinon.stub().resolves({ ...adminUser, enabled: false })
    });
    const router = createMessageRouter(deps);
    const result = await router(ADMIN_PHONE);

    expect(result.type).to.equal("ignored");
  });
});
