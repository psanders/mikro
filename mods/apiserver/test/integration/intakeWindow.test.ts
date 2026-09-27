/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * José keeps gathering after he submits (openspec jose-keep-gathering): the
 * "intake open" window that keeps a RECEIVED application with him, saveAnswer
 * on a submitted application, and finalizeApplication never un-submitting.
 */
import { expect } from "chai";
import type { DbClient } from "@mikro/common";
import { createIsIntakeOpen, INTAKE_WINDOW_MS } from "../../src/api/applications/intakeWindow.js";
import { createUpsertApplication } from "../../src/api/applications/createUpsertApplication.js";
import { createSaveAnswer } from "../../src/api/jose/createSaveAnswer.js";
import { createFinalizeApplication } from "../../src/api/jose/createFinalizeApplication.js";
import { createTestDb, applySchema, type TestDb } from "./setup.js";

const PHONE = "+18095551777";

describe("José intake window Integration", () => {
  let db: TestDb;

  before(async () => {
    db = createTestDb();
    await applySchema(db);
  });

  beforeEach(async () => {
    await db.conversationTurn.deleteMany();
    await db.loanApplication.deleteMany();
  });

  after(async () => {
    await db.$disconnect();
  });

  async function received(data: Record<string, unknown> = {}) {
    return db.loanApplication.create({
      data: {
        sessionId: `sess-${Math.random().toString(36).slice(2)}`,
        status: "RECEIVED",
        source: "FORM",
        firstName: "Rosa",
        lastName: "Pérez",
        phone: PHONE,
        submittedAt: new Date(Date.now() - 60 * 60 * 1000),
        rawData: {} as any,
        ...data
      }
    });
  }

  async function turn(applicationId: string, profile: string, minutesAgo: number) {
    await db.conversationTurn.create({
      data: {
        phone: PHONE,
        role: "AGENT",
        content: "ok",
        profile,
        agentName: profile === "PROSPECT" ? "jose" : "sofia",
        applicationId,
        createdAt: new Date(Date.now() - minutesAgo * 60_000)
      }
    });
  }

  describe("isIntakeOpen", () => {
    const isOpen = () => createIsIntakeOpen(db as any);

    it("is open for a web-form application nobody has talked about yet", async () => {
      const app = await received();
      expect(await isOpen()(app as any)).to.be.true;
    });

    it("stays open while José's last reply is under 24h old", async () => {
      const app = await received();
      await turn(app.id, "PROSPECT", 30);
      expect(await isOpen()(app as any)).to.be.true;
    });

    it("closes once José has been quiet for 24h", async () => {
      const app = await received();
      await turn(app.id, "PROSPECT", INTAKE_WINDOW_MS / 60_000 + 5);
      expect(await isOpen()(app as any)).to.be.false;
    });

    it("does not take over someone already talking with the applicant agent", async () => {
      const app = await received();
      await turn(app.id, "APPLICANT", 10);
      expect(await isOpen()(app as any)).to.be.false;
    });

    it("is closed when José closed intake, and for other statuses", async () => {
      const closed = await received({ intakeClosedAt: new Date() });
      expect(await isOpen()(closed as any)).to.be.false;
      const inReview = await received({ status: "IN_REVIEW" });
      expect(await isOpen()(inReview as any)).to.be.false;
    });
  });

  describe("saveAnswer and finalizeApplication after submission", () => {
    const upsert = () => createUpsertApplication(db as unknown as DbClient);

    it("saves on a submitted application, keeps it RECEIVED, and leaves intake open while fields are missing", async () => {
      const app = await received();
      const save = createSaveAnswer(db as unknown as DbClient, upsert());
      const result = await save(
        { fields: { businessName: "Colmado Rosa" } },
        { sessionId: app.sessionId }
      );

      expect(result.success).to.be.true;
      expect(result.data).to.include({ submitted: true, intakeComplete: false });
      const after = await db.loanApplication.findUniqueOrThrow({ where: { id: app.id } });
      expect(after.status).to.equal("RECEIVED");
      expect(after.businessName).to.equal("Colmado Rosa");
      expect(after.intakeClosedAt).to.equal(null);
    });

    it("finalizing a submitted application only closes intake", async () => {
      const app = await received();
      const finalize = createFinalizeApplication(db as unknown as DbClient, upsert());

      const result = await finalize({ outcome: "abandoned" }, { sessionId: app.sessionId });

      expect(result.data).to.include({ outcome: "intake_closed" });
      const after = await db.loanApplication.findUniqueOrThrow({ where: { id: app.id } });
      expect(after.status).to.equal("RECEIVED");
      expect(after.intakeClosedAt).to.be.instanceOf(Date);
    });
  });
});
