/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import {
  createMessageRouter,
  REAPPLY_COOLDOWN_DAYS
} from "../../src/router/createMessageRouter.js";

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

// openspec cx-role-based-agents: who is writing picks the profile.
describe("createMessageRouter — CX routing by role and application status", () => {
  const PHONE = "+18095550009";
  const customer = { id: "cust-1", name: "Ana López", phone: PHONE, isActive: true };
  const app = (status: string, submittedAt: Date | null = null) => ({
    applicationId: "app-1",
    sessionId: "s-1",
    status: status as never,
    submittedAt
  });
  const ref = { applicationId: "app-1", sessionId: "s-1", phone: PHONE };

  afterEach(() => sinon.restore());

  const cases: Array<[string, ReturnType<typeof app> | null, Record<string, unknown>]> = [
    ["no application → guest", null, { type: "guest", phone: PHONE }],
    ["DRAFT → prospect (intake)", app("DRAFT"), { type: "prospect", phase: "intake", ...ref }],
    ["never-submitted ABANDONED → reopen", app("ABANDONED"), { type: "reopen", ...ref }],
    [
      "ABANDONED after submission → guest",
      app("ABANDONED", new Date()),
      { type: "guest", phone: PHONE }
    ],
    ["RECEIVED → applicant", app("RECEIVED", new Date()), { type: "applicant", ...ref }],
    [
      "RECEIVED with intake open → prospect (enrichment)",
      { ...app("RECEIVED", new Date()), intakeOpen: true },
      { type: "prospect", phase: "enrichment", ...ref }
    ],
    [
      "IN_REVIEW ignores intakeOpen → applicant",
      { ...app("IN_REVIEW", new Date()), intakeOpen: true },
      { type: "applicant", ...ref }
    ],
    ["IN_REVIEW → applicant", app("IN_REVIEW", new Date()), { type: "applicant", ...ref }],
    [
      "PENDING_DECISION → applicant",
      app("PENDING_DECISION", new Date()),
      { type: "applicant", ...ref }
    ],
    ["APPROVED → applicant", app("APPROVED", new Date()), { type: "applicant", ...ref }],
    [
      "CONVERTED without customer → guest",
      app("CONVERTED", new Date()),
      { type: "guest", phone: PHONE }
    ]
  ];

  for (const [name, found, expected] of cases) {
    it(name, async () => {
      const router = createMessageRouter(
        makeDeps({ findApplicationByPhone: sinon.stub().resolves(found) })
      );
      expect(await router(PHONE)).to.deep.equal(expected);
    });
  }

  it("routes a customer to CUSTOMER; a DRAFT of theirs is not attached", async () => {
    const router = createMessageRouter(
      makeDeps({
        getCustomerByPhone: sinon.stub().resolves(customer),
        findApplicationByPhone: sinon.stub().resolves(app("DRAFT"))
      })
    );
    expect(await router(PHONE)).to.deep.equal({
      type: "customer",
      customerId: "cust-1",
      name: "Ana López",
      phone: PHONE
    });
  });

  it("attaches a returning customer's application in the review pipeline", async () => {
    const router = createMessageRouter(
      makeDeps({
        getCustomerByPhone: sinon.stub().resolves(customer),
        findApplicationByPhone: sinon.stub().resolves(app("IN_REVIEW", new Date()))
      })
    );
    expect(await router(PHONE)).to.deep.equal({
      type: "customer",
      customerId: "cust-1",
      name: "Ana López",
      phone: PHONE,
      applicationId: "app-1"
    });
  });

  it("routes an employee who is also a customer as the employee", async () => {
    const router = createMessageRouter(
      makeDeps({
        getUserByPhone: sinon.stub().resolves({ ...collectorUser, phone: PHONE }),
        getCustomerByPhone: sinon.stub().resolves(customer)
      })
    );
    const result = await router(PHONE);
    expect(result.type).to.equal("user");
  });

  it("routes a REVIEWER-only user as REVIEWER, not COLLECTOR", async () => {
    const router = createMessageRouter(
      makeDeps({
        getUserByPhone: sinon
          .stub()
          .resolves({ ...collectorUser, roles: [{ role: "REVIEWER" as const }] })
      })
    );
    const result = await router(COLLECTOR_PHONE);
    expect(result.type === "user" && result.role).to.equal("REVIEWER");
  });

  it("prefers ADMIN over REVIEWER over COLLECTOR", async () => {
    const router = createMessageRouter(
      makeDeps({
        getUserByPhone: sinon.stub().resolves({
          ...collectorUser,
          roles: [{ role: "COLLECTOR" as const }, { role: "REVIEWER" as const }]
        })
      })
    );
    const result = await router(COLLECTOR_PHONE);
    expect(result.type === "user" && result.role).to.equal("REVIEWER");
  });
});

// Founder decision 2026-09-26: a rejected applicant may apply again after 30 days.
describe("createMessageRouter — rejected applicants' reapply cooldown", () => {
  const PHONE = "+18095550011";
  const DAY = 24 * 60 * 60 * 1000;
  const rejected = (decidedAt: Date) => ({
    applicationId: "app-9",
    sessionId: "s-9",
    status: "REJECTED" as never,
    submittedAt: new Date(decidedAt.getTime() - DAY),
    decidedAt
  });

  it("flags a recent rejection with the date they may apply again", async () => {
    const decidedAt = new Date(Date.now() - 5 * DAY);
    const router = createMessageRouter(
      makeDeps({ findApplicationByPhone: sinon.stub().resolves(rejected(decidedAt)) })
    );
    const result = await router(PHONE);
    expect(result).to.deep.equal({
      type: "guest",
      phone: PHONE,
      previouslyRejected: true,
      reapplyFrom: new Date(decidedAt.getTime() + REAPPLY_COOLDOWN_DAYS * DAY)
    });
  });

  it("treats a rejection older than the cooldown as a regular guest", async () => {
    const router = createMessageRouter(
      makeDeps({
        findApplicationByPhone: sinon.stub().resolves(rejected(new Date(Date.now() - 31 * DAY)))
      })
    );
    expect(await router(PHONE)).to.deep.equal({ type: "guest", phone: PHONE });
  });

  it("gives an out-of-area rejection no reapply date, at any age", async () => {
    for (const daysAgo of [2, 90]) {
      const router = createMessageRouter(
        makeDeps({
          findApplicationByPhone: sinon.stub().resolves({
            ...rejected(new Date(Date.now() - daysAgo * DAY)),
            rejectionReason: "OUT_OF_COVERAGE_AREA"
          })
        })
      );
      expect(await router(PHONE)).to.deep.equal({ type: "guest", phone: PHONE, outOfArea: true });
    }
  });
});
