/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import {
  createListMyPayments,
  createSendMyReceipt,
  createGetMyApplicationStatus,
  createAttachApplicationEvidence,
  createRequestHumanHandoff
} from "../../src/api/cx/selfService.js";

const CUSTOMER_CTX = { customerId: "cust-1", phone: "+18095550001", profile: "CUSTOMER" };

describe("CX self-service tools", () => {
  afterEach(() => sinon.restore());

  describe("listMyPayments", () => {
    it("scopes the loan lookup to the context customer, not the model's args", async () => {
      const findFirst = sinon.stub().resolves(null);
      const db = { loan: { findFirst }, payment: { findMany: sinon.stub() } } as any;

      const result = await createListMyPayments(db)(
        { loanId: 10034, customerId: "someone-else" },
        CUSTOMER_CTX
      );

      expect(result.success).to.be.false;
      expect(findFirst.firstCall.args[0].where).to.deep.equal({
        loanId: 10034,
        customerId: "cust-1"
      });
    });

    it("refuses without a customer in context", async () => {
      const db = { loan: { findFirst: sinon.stub() } } as any;
      const result = await createListMyPayments(db)({ loanId: 1 }, { phone: "+1" });
      expect(result.success).to.be.false;
      expect(db.loan.findFirst.called).to.be.false;
    });
  });

  describe("sendMyReceipt", () => {
    it("sends only the sender's own payment, and only to the sender's phone", async () => {
      const findFirst = sinon.stub().resolves({ id: "pay-1" });
      const db = { payment: { findFirst } } as any;
      const sendReceipt = sinon.stub().resolves({ success: true });

      const result = await createSendMyReceipt(db, sendReceipt)(
        { paymentId: "pay-1", phone: "+18090000000" },
        CUSTOMER_CTX
      );

      expect(result.success).to.be.true;
      expect(findFirst.firstCall.args[0].where).to.deep.equal({
        id: "pay-1",
        loan: { customerId: "cust-1" }
      });
      expect(sendReceipt.calledOnceWith({ paymentId: "pay-1", phone: "+18095550001" })).to.be.true;
    });

    it("does not send a payment that belongs to someone else", async () => {
      const db = { payment: { findFirst: sinon.stub().resolves(null) } } as any;
      const sendReceipt = sinon.stub();
      const result = await createSendMyReceipt(db, sendReceipt)({ paymentId: "x" }, CUSTOMER_CTX);
      expect(result.success).to.be.false;
      expect(sendReceipt.called).to.be.false;
    });
  });

  describe("getMyApplicationStatus", () => {
    function client(app: Record<string, unknown>, labels: Array<string | null> = []) {
      return {
        loanApplication: { findUnique: async () => app },
        applicationDocument: {
          count: async () => labels.length,
          findMany: async () => labels.map((label) => ({ label }))
        }
      } as any;
    }

    it("returns only the plain stage and missing evidence — no score or reasons", async () => {
      const app = {
        id: "app-1",
        status: "IN_REVIEW",
        score: 71,
        riskBand: "B",
        recommendation: "APPROVE",
        decisionNote: "secret",
        idFrontFilename: "a.jpg",
        idBackFilename: null
      };

      const result = await createGetMyApplicationStatus(client(app, ["Fachada"]))({
        applicationId: "app-1"
      });

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal({
        stage: "en revisión",
        missingEvidence: ["ID_BACK", "BUSINESS_PHOTO", "BUSINESS_PHOTO"],
        businessPhotos: {
          received: 1,
          required: 3,
          next: "el interior del negocio, donde atiende o trabaja"
        }
      });
      expect(JSON.stringify(result)).to.not.match(/71|APPROVE|secret|riskBand/);
    });

    it("asks for the first unlabeled shot, whatever order earlier photos came in", async () => {
      const app = { id: "app-1", status: "RECEIVED", idFrontFilename: "a", idBackFilename: "b" };
      const result = await createGetMyApplicationStatus(client(app, ["Interior", null]))({
        applicationId: "app-1"
      });
      expect(result.data?.businessPhotos).to.deep.equal({
        received: 2,
        required: 3,
        next: "el frente del negocio por fuera, con el letrero si tiene"
      });
    });

    it("leaves businessPhotos out once enough photos are in", async () => {
      const app = { id: "app-1", status: "RECEIVED", idFrontFilename: "a", idBackFilename: "b" };
      const result = await createGetMyApplicationStatus(
        client(app, ["Fachada", "Interior", "Mercancía"])
      )({ applicationId: "app-1" });
      expect(result.data).to.deep.equal({ stage: "recibida", missingEvidence: [] });
    });

    it("asks for no evidence once the application is with the decider", async () => {
      const app = { id: "app-1", status: "PENDING_DECISION" };
      const result = await createGetMyApplicationStatus(client(app))({ applicationId: "app-1" });
      expect(result.data).to.deep.equal({ stage: "en revisión", missingEvidence: [] });
    });

    it("treats a closed application as no application", async () => {
      const app = { id: "app-1", status: "REJECTED" };
      const result = await createGetMyApplicationStatus(client(app))({ applicationId: "app-1" });
      expect(result.success).to.be.false;
    });
  });

  describe("attachApplicationEvidence", () => {
    it("fails when the turn carries no image (never trusts a model URL)", async () => {
      const db = { loanApplication: { findUnique: sinon.stub() } } as any;
      const result = await createAttachApplicationEvidence(db)(
        { kind: "BUSINESS_PHOTO", url: "https://evil.example/x.jpg" },
        { applicationId: "app-1", phone: "+18095550001" }
      );
      expect(result.success).to.be.false;
      expect(db.loanApplication.findUnique.called).to.be.false;
    });

    it("refuses once the application is with the decider", async () => {
      const db = {
        loanApplication: { findUnique: async () => ({ id: "app-1", status: "PENDING_DECISION" }) }
      } as any;
      const result = await createAttachApplicationEvidence(db)(
        { kind: "BUSINESS_PHOTO" },
        {
          applicationId: "app-1",
          phone: "+18095550001",
          imageDataUrl: "data:image/jpeg;base64,/9j/4AAQ"
        }
      );
      expect(result.success).to.be.false;
    });
  });

  describe("attachApplicationEvidence (WhatsApp photos)", () => {
    // saveImage only checks mime + size and hashes the bytes (fixture contractsPath).
    const IMAGE = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";
    const OTHER_SHA = "0".repeat(64);
    const ctx = { applicationId: "app-1", phone: "+18095550001", imageDataUrl: IMAGE };

    function db(docs: Array<{ label: string | null; sha256: string }>, app = {}) {
      const create = sinon.stub().callsFake(async ({ data }) => {
        docs.push({ label: data.label, sha256: data.sha256 });
        return data;
      });
      return {
        create,
        client: {
          loanApplication: {
            findUnique: async () => ({
              id: "app-1",
              status: "RECEIVED",
              idFrontFilename: "front.jpg",
              idBackFilename: "back.jpg",
              ...app
            })
          },
          applicationDocument: {
            create,
            count: async () => docs.length,
            findMany: async ({ where }: any) =>
              where.kind ? docs.map((d) => ({ ...d, kind: "BUSINESS_PHOTO" })) : docs
          }
        } as any
      };
    }

    it("labels each business photo with the shot it was asked for", async () => {
      const { client, create } = db([{ label: "Fachada", sha256: OTHER_SHA }]);
      const result = await createAttachApplicationEvidence(client)(
        { kind: "BUSINESS_PHOTO" },
        { ...ctx, imageDataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAg==" }
      );
      expect(result.success).to.be.true;
      expect(create.firstCall.args[0].data.label).to.equal("Interior");
      expect(result.data?.businessPhotos?.next).to.equal(
        "la mercancía, los productos o las herramientas de trabajo"
      );
    });

    it("refuses the same picture sent twice and keeps nothing", async () => {
      const docs: Array<{ label: string | null; sha256: string }> = [];
      const { client, create } = db(docs);
      const first = await createAttachApplicationEvidence(client)({ kind: "BUSINESS_PHOTO" }, ctx);
      const again = await createAttachApplicationEvidence(client)({ kind: "BUSINESS_PHOTO" }, ctx);
      expect(first.success).to.be.true;
      expect(again.success).to.be.false;
      expect(again.message).to.match(/ya la habíamos recibido/);
      expect(create.calledOnce).to.be.true;
    });

    it("refuses a business photo that is the cédula picture again", async () => {
      const { createHash } = await import("node:crypto");
      const sha = createHash("sha256")
        .update(Buffer.from(IMAGE.split(",")[1], "base64"))
        .digest("hex");
      const { client, create } = db([], { idFrontFilename: `${sha}.jpg` });
      const result = await createAttachApplicationEvidence(client)({ kind: "BUSINESS_PHOTO" }, ctx);
      expect(result.success).to.be.false;
      expect(create.called).to.be.false;
    });
  });

  describe("requestHumanHandoff", () => {
    it("opens the hand-off with identity from context", async () => {
      const openHandoff = sinon.stub().resolves({ opened: true });
      const result = await createRequestHumanHandoff(openHandoff)(
        { reason: "  está frustrado  ", summary: " Pide hablar del pago. ", phone: "+18090000000" },
        { ...CUSTOMER_CTX, name: "Ana" }
      );
      expect(result.success).to.be.true;
      expect(openHandoff.firstCall.args[0]).to.deep.equal({
        phone: "+18095550001",
        profile: "CUSTOMER",
        reason: "está frustrado",
        applicationId: undefined,
        customerId: "cust-1",
        displayName: "Ana",
        whatsappUserId: undefined,
        username: undefined,
        summary: "Pide hablar del pago."
      });
    });
  });
});
