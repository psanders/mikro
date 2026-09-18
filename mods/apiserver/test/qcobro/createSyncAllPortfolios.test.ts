/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Unit tests for the full-base QCobro sync pass: how portfolios with zero
 * matching customers are handled per `syncMode`. Under REPLACE they are pushed
 * with `rows: []` (an empty snapshot empties the portfolio on the QCobro side,
 * so stale accounts don't linger); under any other mode they are skipped.
 */
import { expect } from "chai";
import sinon from "sinon";
import type { DbClient, ResolvedMikroConfig } from "@mikro/common";
import { createSyncAllPortfolios } from "../../src/qcobro/createSyncAllPortfolios.js";
import type { QCobroClient, SyncAccountsInput } from "../../src/qcobro/createQCobroClient.js";

type SyncMode = SyncAccountsInput["mode"];

const PORTFOLIOS = [
  // Matched by customer c1's MANUAL tag.
  { id: "pf-watch", match: { any: ["risk:watch"] } },
  // Nobody carries these tags — zero matching customers this pass.
  { id: "pf-pre-mora", match: { any: ["dpd:1_7"] } },
  { id: "pf-por-vencer", match: { any: ["due:today", "due:1_3"] } }
];

function makeConfig(syncMode: SyncMode): () => ResolvedMikroConfig {
  const cfg = {
    loans: {
      defaultMoraRate: 0.1,
      moraGraceDays: 0,
      moraCapInCuotas: 1,
      moraMinDop: 0,
      moraStopOnDefault: false,
      moraEffectiveFrom: undefined
    },
    qcobro: {
      syncMode,
      balanceBasis: "past_due_amount",
      portfolios: PORTFOLIOS
    }
  };
  return () => cfg as unknown as ResolvedMikroConfig;
}

/** A DbClient stub: one active customer with only a MANUAL `risk:watch` tag and no loans. */
function makeDb(): DbClient {
  const db = {
    customer: {
      findMany: sinon.stub().resolves([{ id: "c1", name: "Ana Pérez", phone: "+18095550101" }]),
      update: sinon.stub().resolves({})
    },
    customerTag: {
      findMany: sinon.stub().resolves([{ customerId: "c1", tag: "risk:watch", source: "MANUAL" }]),
      deleteMany: sinon.stub().resolves({ count: 0 }),
      upsert: sinon.stub().resolves({})
    },
    loan: { findMany: sinon.stub().resolves([]) },
    payment: { findMany: sinon.stub().resolves([]) }
  };
  return db as unknown as DbClient;
}

function makeClient(failFor: string[] = []) {
  const syncAccounts = sinon.stub<[SyncAccountsInput], Promise<void>>().callsFake(async (input) => {
    if (failFor.includes(input.portfolioId)) throw new Error("boom");
  });
  const client: QCobroClient = { syncAccounts };
  return { client, syncAccounts };
}

function callsByPortfolio(stub: sinon.SinonStub<[SyncAccountsInput], Promise<void>>) {
  return new Map(stub.getCalls().map((c) => [c.args[0].portfolioId, c.args[0]]));
}

describe("createSyncAllPortfolios", () => {
  afterEach(() => sinon.restore());

  it("empties portfolios with no matching customers when syncMode is REPLACE", async () => {
    const { client, syncAccounts } = makeClient();
    const sync = createSyncAllPortfolios(makeDb(), {
      getConfigFn: makeConfig("REPLACE"),
      client
    });

    const result = await sync();

    expect(syncAccounts.callCount).to.equal(3);
    const calls = callsByPortfolio(syncAccounts);
    expect(calls.get("pf-watch")?.rows.map((r) => r.externalId)).to.deep.equal(["c1"]);
    expect(calls.get("pf-pre-mora")).to.deep.equal({
      portfolioId: "pf-pre-mora",
      mode: "REPLACE",
      rows: []
    });
    expect(calls.get("pf-por-vencer")).to.deep.equal({
      portfolioId: "pf-por-vencer",
      mode: "REPLACE",
      rows: []
    });
    expect(result).to.include({
      customers: 1,
      portfoliosPushed: 1,
      portfoliosCleared: 2,
      portfoliosSkipped: 0
    });
  });

  for (const mode of ["UPDATE_EXISTING", "APPEND_ONLY"] as const) {
    it(`skips portfolios with no matching customers when syncMode is ${mode}`, async () => {
      const { client, syncAccounts } = makeClient();
      const sync = createSyncAllPortfolios(makeDb(), {
        getConfigFn: makeConfig(mode),
        client
      });

      const result = await sync();

      expect(syncAccounts.callCount).to.equal(1);
      expect(syncAccounts.firstCall.args[0].portfolioId).to.equal("pf-watch");
      expect(syncAccounts.firstCall.args[0].mode).to.equal(mode);
      expect(syncAccounts.firstCall.args[0].rows).to.have.lengthOf(1);
      expect(result).to.include({
        customers: 1,
        portfoliosPushed: 1,
        portfoliosCleared: 0,
        portfoliosSkipped: 2
      });
    });
  }

  it("does not count an empty REPLACE push as cleared when syncAccounts fails", async () => {
    const { client, syncAccounts } = makeClient(["pf-pre-mora"]);
    const sync = createSyncAllPortfolios(makeDb(), {
      getConfigFn: makeConfig("REPLACE"),
      client
    });

    const result = await sync();

    expect(syncAccounts.callCount).to.equal(3);
    expect(result).to.include({ portfoliosPushed: 1, portfoliosCleared: 1, portfoliosSkipped: 0 });
  });
});
