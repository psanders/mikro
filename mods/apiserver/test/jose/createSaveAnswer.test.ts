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

  it("refuses filler answers instead of saving them", async () => {
    const { tool, upsert } = makeTool(null);

    for (const filler of ["N/A", "n/a", "No tengo", "ninguno", "-", "0000000000"]) {
      const result = await tool({ fields: { spouseName: filler } }, CTX);
      expect(result.success, filler).to.be.false;
      expect(result.data!.invalid).to.include("spouseName");
      expect((result.data!.invalidReasons as Record<string, string>).spouseName).to.match(
        /No aplica/
      );
    }
    expect(upsert.called).to.be.false;
  });

  it("stores a marital status code", async () => {
    const { tool, upsert } = makeTool(null);
    const result = await tool({ fields: { maritalStatus: "UNION_LIBRE" } }, CTX);
    expect(result.success).to.be.true;
    expect(upsert.firstCall.args[0].maritalStatus).to.equal("UNION_LIBRE");
  });

  it("rejects anything but a code (labels too), naming the valid codes", async () => {
    for (const value of ["complicado", "Soltero(a)", "soltera"]) {
      const { tool, upsert } = makeTool(null);

      const result = await tool({ fields: { maritalStatus: value } }, CTX);

      expect(result.success, value).to.be.false;
      expect((result.data!.invalidReasons as Record<string, string>).maritalStatus).to.include(
        "SOLTERO, CASADO, UNION_LIBRE, DIVORCIADO, VIUDO"
      );
      expect(upsert.called, value).to.be.false;
    }
  });

  it("never asks a single applicant about a spouse", async () => {
    const { tool } = makeTool(null);

    const single = await tool({ fields: { maritalStatus: "SOLTERO" } }, CTX);
    expect(single.data!.missingFields).to.not.include.members(["spouseName"]);
    expect(single.data!.missingFields).to.not.include("spousePhone");

    const married = await tool({ fields: { maritalStatus: "CASADO" } }, CTX);
    expect(married.data!.missingFields).to.include("spouseName");
    expect(married.data!.missingFields).to.include("spousePhone");
  });

  it("closes intake for a submitted single applicant once only spouse fields would remain", async () => {
    const update = sinon.stub().resolves(undefined);
    const rawData: Record<string, unknown> = {
      businessAge: "1 a 3 años",
      monthlySales: "RD$25,000 – RD$50,000",
      locationType: "Propio",
      formalization: "Informal (sin RNC)",
      employeeCount: "Solo yo",
      businessPhone: "8095551234",
      referenceName: "Rocío Cabrera",
      referencePhone: "8295245888",
      housingType: "Propia",
      residenceTime: "5 a 10 años",
      addressReference: "Frente a la escuela"
    };
    const existing = {
      id: "app-1",
      status: "RECEIVED",
      intakeClosedAt: null,
      firstName: "Ada",
      lastName: "Padilla",
      phone: "+18492452419",
      idNumber: "037-0105842-6",
      dateOfBirth: new Date("1987-03-15"),
      maritalStatus: null,
      businessType: "OTRO",
      businessName: "Cafetería",
      requestedAmount: 20000,
      purpose: "Inventario",
      requestedTermWeeks: 12,
      province: "PUERTO_PLATA",
      homeAddress: "San Marcos",
      rawData
    };
    const findFirst = sinon.stub().resolves(existing);
    const upsert = sinon.stub().resolves(undefined);
    const tool = createSaveAnswer({ loanApplication: { findFirst, update } } as any, upsert);

    const result = await tool({ fields: { maritalStatus: "SOLTERO" } }, CTX);

    expect(result.data!.missingFields).to.deep.equal([]);
    expect(result.data!.intakeComplete).to.be.true;
    expect(update.calledOnce).to.be.true;
  });
});
