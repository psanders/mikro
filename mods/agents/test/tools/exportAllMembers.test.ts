/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { handleExportAllMembers } from "../../src/tools/executor/exportAllMembers.js";
import type { ToolExecutorDependencies, ExportedMember } from "../../src/tools/executor/types.js";

function minimalMember(overrides: Partial<ExportedMember> = {}): ExportedMember {
  return {
    name: "Test",
    phone: "+123",
    collectionPoint: null,
    notes: null,
    referredBy: { name: "Ref" },
    loans: [
      {
        loanId: 1,
        notes: null,
        paymentFrequency: "WEEKLY",
        createdAt: new Date("2026-01-01"),
        termLength: 12,
        payments: [{ paidAt: new Date("2026-01-08") }]
      }
    ],
    ...overrides
  };
}

describe("handleExportAllMembers", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("default format calls renderMembersReportToPng, uploads as image/png, sends document with .png filename", async () => {
    const members = [minimalMember()];
    const pngBuffer = Buffer.from("png");
    const renderStub = sinon.stub().resolves(pngBuffer);
    const uploadStub = sinon.stub().resolves("media-id");
    const sendStub = sinon.stub().resolves({ messages: [{ id: "msg-1" }] });

    const deps = {
      exportAllMembers: sinon.stub().resolves(members),
      renderMembersReportToPng: renderStub,
      uploadMedia: uploadStub,
      sendWhatsAppMessage: sendStub
    } as unknown as ToolExecutorDependencies;

    const result = await handleExportAllMembers(deps, {}, { userId: "admin-1", phone: "+999" });

    expect(result.success).to.be.true;
    expect(renderStub.calledOnceWith(members)).to.be.true;
    expect(uploadStub.calledOnceWith(pngBuffer, "image/png")).to.be.true;
    expect(sendStub.calledOnce).to.be.true;
    expect(sendStub.firstCall.args[0].mediaType).to.equal("document");
    expect(sendStub.firstCall.args[0].documentFilename).to.match(/\.png$/);
  });

  it('format "detailed" calls generateMembersExcel, uploads xlsx, sends document with .xlsx filename', async () => {
    const members = [minimalMember()];
    const uploadStub = sinon.stub().resolves("media-id");
    const sendStub = sinon.stub().resolves({ messages: [{ id: "msg-1" }] });

    const deps = {
      exportAllMembers: sinon.stub().resolves(members),
      renderMembersReportToPng: sinon.stub(),
      uploadMedia: uploadStub,
      sendWhatsAppMessage: sendStub
    } as unknown as ToolExecutorDependencies;

    const result = await handleExportAllMembers(
      deps,
      { format: "detailed" },
      { userId: "admin-1", phone: "+999" }
    );

    expect(result.success).to.be.true;
    expect(uploadStub.calledOnce).to.be.true;
    expect(uploadStub.firstCall.args[1]).to.equal(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(sendStub.firstCall.args[0].documentFilename).to.match(/\.xlsx$/);
  });

  it("missing adminId returns error", async () => {
    const deps = {
      exportAllMembers: sinon.stub().resolves([minimalMember()]),
      renderMembersReportToPng: sinon.stub(),
      uploadMedia: sinon.stub(),
      sendWhatsAppMessage: sinon.stub()
    } as unknown as ToolExecutorDependencies;

    const result = await handleExportAllMembers(deps, {}, { phone: "+999" });

    expect(result.success).to.be.false;
    expect(result.message).to.include("admin");
  });

  it("missing adminPhone returns error", async () => {
    const deps = {
      exportAllMembers: sinon.stub().resolves([minimalMember()]),
      renderMembersReportToPng: sinon.stub(),
      uploadMedia: sinon.stub(),
      sendWhatsAppMessage: sinon.stub()
    } as unknown as ToolExecutorDependencies;

    const result = await handleExportAllMembers(deps, {}, { userId: "admin-1" });

    expect(result.success).to.be.false;
    expect(result.message).to.include("telefono");
  });

  it("empty members returns success with no report sent", async () => {
    const exportStub = sinon.stub().resolves([]);
    const renderStub = sinon.stub();
    const uploadStub = sinon.stub();
    const sendStub = sinon.stub();

    const deps = {
      exportAllMembers: exportStub,
      renderMembersReportToPng: renderStub,
      uploadMedia: uploadStub,
      sendWhatsAppMessage: sendStub
    } as unknown as ToolExecutorDependencies;

    const result = await handleExportAllMembers(deps, {}, { userId: "admin-1", phone: "+999" });

    expect(result.success).to.be.true;
    expect(result.message).to.include("No hay miembros activos");
    expect(renderStub.called).to.be.false;
    expect(uploadStub.called).to.be.false;
    expect(sendStub.called).to.be.false;
  });

  it("upload failure returns error", async () => {
    const members = [minimalMember()];
    const renderStub = sinon.stub().resolves(Buffer.from("png"));
    const uploadStub = sinon.stub().rejects(new Error("Upload failed"));

    const deps = {
      exportAllMembers: sinon.stub().resolves(members),
      renderMembersReportToPng: renderStub,
      uploadMedia: uploadStub,
      sendWhatsAppMessage: sinon.stub()
    } as unknown as ToolExecutorDependencies;

    const result = await handleExportAllMembers(deps, {}, { userId: "admin-1", phone: "+999" });

    expect(result.success).to.be.false;
    expect(result.message).to.include("Error al enviar");
    expect(result.message).to.include("Upload failed");
  });

  it("send failure returns error", async () => {
    const members = [minimalMember()];
    const renderStub = sinon.stub().resolves(Buffer.from("png"));
    const uploadStub = sinon.stub().resolves("media-id");
    const sendStub = sinon.stub().rejects(new Error("Send failed"));

    const deps = {
      exportAllMembers: sinon.stub().resolves(members),
      renderMembersReportToPng: renderStub,
      uploadMedia: uploadStub,
      sendWhatsAppMessage: sendStub
    } as unknown as ToolExecutorDependencies;

    const result = await handleExportAllMembers(deps, {}, { userId: "admin-1", phone: "+999" });

    expect(result.success).to.be.false;
    expect(result.message).to.include("Error al enviar");
    expect(result.message).to.include("Send failed");
  });
});
