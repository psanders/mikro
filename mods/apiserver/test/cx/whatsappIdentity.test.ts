/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import {
  createLinkWhatsAppIdentity,
  createRecordSharedWhatsAppPhone,
  createFindCustomerByWhatsAppUserId
} from "../../src/api/cx/whatsappIdentity.js";
import { createGetApplicationByWhatsAppUserId } from "../../src/api/applications/createGetApplicationByPhone.js";
import { createSubmitApplicationFromFlow } from "../../src/api/applications/createSubmitApplicationFromFlow.js";

const BSUID = "DO.1610031533916997";
const PHONE = "+18095550020";

function db(counts = { customers: 1, applications: 2 }) {
  return {
    customer: {
      updateMany: sinon.stub().resolves({ count: counts.customers }),
      findFirst: sinon.stub().resolves(null)
    },
    loanApplication: {
      updateMany: sinon.stub().resolves({ count: counts.applications }),
      findFirst: sinon.stub().resolves(null)
    }
  } as any;
}

describe("WhatsApp identity (username senders)", () => {
  afterEach(() => sinon.restore());

  it("links the BSUID and username to every customer and application with the phone", async () => {
    const d = db();
    await createLinkWhatsAppIdentity(d)({ phone: PHONE, bsuid: BSUID, username: "ana" });

    for (const table of [d.customer, d.loanApplication]) {
      const args = table.updateMany.firstCall.args[0];
      expect(args.where.phone).to.equal(PHONE);
      // Rows already linked to this BSUID are left alone (idempotent).
      expect(args.where.OR).to.deep.equal([
        { whatsappUserId: null },
        { whatsappUserId: { not: BSUID } }
      ]);
      expect(args.data).to.deep.equal({ whatsappUserId: BSUID, whatsappUsername: "ana" });
    }
  });

  it("does nothing without a phone, and never throws", async () => {
    const d = db();
    await createLinkWhatsAppIdentity(d)({ bsuid: BSUID });
    expect(d.customer.updateMany.called).to.be.false;

    d.customer.updateMany = sinon.stub().rejects(new Error("db down"));
    await createLinkWhatsAppIdentity(d)({ phone: PHONE, bsuid: BSUID });
  });

  it("fills a shared phone on the sender's phone-less applications, then links", async () => {
    const d = db();
    await createRecordSharedWhatsAppPhone(d)({ phone: PHONE, bsuid: BSUID });

    expect(d.loanApplication.updateMany.firstCall.args[0]).to.deep.equal({
      where: { whatsappUserId: BSUID, phone: null },
      data: { phone: PHONE }
    });
    expect(d.customer.updateMany.calledOnce).to.be.true;
  });

  it("finds the customer and the latest application by BSUID", async () => {
    const d = db();
    d.customer.findFirst.resolves({ id: "c", name: "Ana", phone: PHONE, isActive: true });
    d.loanApplication.findFirst.resolves({
      id: "app-1",
      sessionId: "s",
      status: "RECEIVED",
      submittedAt: null,
      decidedAt: null
    });

    expect(await createFindCustomerByWhatsAppUserId(d)(BSUID)).to.deep.include({ id: "c" });
    expect(d.customer.findFirst.firstCall.args[0].where).to.deep.equal({ whatsappUserId: BSUID });
    expect(await createGetApplicationByWhatsAppUserId(d)(BSUID)).to.deep.include({
      applicationId: "app-1",
      status: "RECEIVED"
    });
  });

  describe("WhatsApp Flow submission from a username sender", () => {
    it("folds into the application already linked to the BSUID, keeps its phone, stores the BSUID", async () => {
      const upsertApplication = sinon.stub().resolves({});
      const submit = createSubmitApplicationFromFlow({
        upsertApplication,
        findLatestApplicationByPhone: sinon.stub().resolves(null),
        findLatestApplicationByWhatsAppUserId: sinon
          .stub()
          .resolves({ sessionId: "existing-s", phone: PHONE })
      });

      await submit(
        { sessionId: "wa-1", partial: false, firstName: "Topacio" },
        { whatsappUserId: BSUID, whatsappUsername: "topacio1234" }
      );

      const input = upsertApplication.firstCall.args[0];
      expect(input.sessionId).to.equal("existing-s");
      expect(input.phone).to.equal(PHONE);
      expect(input.whatsappUserId).to.equal(BSUID);
      expect(input.whatsappUsername).to.equal("topacio1234");
    });

    it("creates a phone-less application tied to the BSUID when nothing matches", async () => {
      const upsertApplication = sinon.stub().resolves({});
      const submit = createSubmitApplicationFromFlow({
        upsertApplication,
        findLatestApplicationByPhone: sinon.stub().resolves(null),
        findLatestApplicationByWhatsAppUserId: sinon.stub().resolves(null)
      });

      await submit({ sessionId: "wa-2", partial: false }, { whatsappUserId: BSUID });

      const input = upsertApplication.firstCall.args[0];
      expect(input.sessionId).to.equal("wa-2");
      expect(input.phone).to.equal(null);
      expect(input.whatsappUserId).to.equal(BSUID);
    });
  });
});
