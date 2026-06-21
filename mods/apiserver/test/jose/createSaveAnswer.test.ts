/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Regression tests for José's saveAnswer tool: phone validation (catches the
 * 9-digit reference number that slipped through in manual testing) and
 * priority-ordered missingFields (highest-weight questions surface first).
 */
import { expect } from "chai";
import sinon from "sinon";
import { createSaveAnswer } from "../../src/api/jose/createSaveAnswer.js";

const CTX = { sessionId: "sess-jose-1", phone: "+18095550000" };

function makeTool(existing: Record<string, unknown> | null = null) {
  const findFirst = sinon.stub().resolves(existing);
  const upsert = sinon.stub().resolves(undefined);
  const tool = createSaveAnswer({ loanApplication: { findFirst } } as any, upsert);
  return { tool, findFirst, upsert };
}

describe("createSaveAnswer", () => {
  afterEach(() => sinon.restore());

  it("rejects an invalid phone, re-asks, and still saves the other fields", async () => {
    const { tool, upsert } = makeTool(null);

    const result = await tool(
      { fields: { referenceName: "Antonio Miguel", referencePhone: "892222222" } },
      CTX
    );

    expect(result.success).to.be.true;
    expect(result.data!.saved).to.include("referenceName");
    expect(result.data!.saved).to.not.include("referencePhone");
    expect(result.data!.invalid).to.include("referencePhone");
    expect((result.data!.invalidReasons as Record<string, string>).referencePhone).to.be.a(
      "string"
    );
    // The good field is persisted; the bad phone is not.
    expect(upsert.calledOnce).to.be.true;
  });

  it("accepts a Dominican phone in local 10-digit format", async () => {
    const { tool } = makeTool(null);

    const result = await tool({ fields: { referencePhone: "809-234-5678" } }, CTX);

    expect(result.success).to.be.true;
    expect(result.data!.saved).to.include("referencePhone");
    expect(result.data!.invalid).to.not.include("referencePhone");
  });

  it("accepts a phone with country code (+1) and rejects a too-short number", async () => {
    const { tool } = makeTool(null);

    const ok = await tool({ fields: { businessPhone: "+1 829 555 1234" } }, CTX);
    expect(ok.data!.saved).to.include("businessPhone");

    const bad = await tool({ fields: { businessPhone: "55512" } }, CTX);
    expect(bad.data!.invalid).to.include("businessPhone");
  });

  it("returns missingFields ordered by priority (knockouts first)", async () => {
    const { tool } = makeTool(null);

    const result = await tool({ fields: { firstName: "Pedro" } }, CTX);

    const missing = result.data!.missingFields as string[];
    expect(missing[0]).to.equal("province");
    expect(missing[1]).to.equal("businessType");
    // low-weight support fields come after high-weight capacity fields
    expect(missing.indexOf("monthlySales")).to.be.lessThan(missing.indexOf("referencePhone"));
  });
});
