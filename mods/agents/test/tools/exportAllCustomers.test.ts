/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { handleExportAllCustomers } from "../../src/tools/executor/exportAllCustomers.js";
import type { ToolExecutorDependencies, ExportedCustomer } from "../../src/tools/executor/types.js";

function minimalCustomer(overrides: Partial<ExportedCustomer> = {}): ExportedCustomer {
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

describe("handleExportAllCustomers", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("default format calls renderCustomersReportToPng, uploads as image/png, sends document with .png filename", async () => {
    const customers = [minimalCustomer()];
    const pngBuffer = Buffer.from("png");
    const renderStub = sinon.stub().resolves(pngBuffer);
    const uploadStub = sinon.stub().resolves("media-id");
    const sendStub = sinon.stub().resolves({ messages: [{ id: "msg-1" }] });

    const deps = {
      exportAllCustomers: sinon.stub().resolves(customers),
      renderCustomersReportToPng: renderStub,
      uploadMedia: uploadStub,
      sendWhatsAppMessage: sendStub
    } as unknown as ToolExecutorDependencies;

    const result = await handleExportAllCustomers(deps, {}, { userId: "admin-1", phone: "+999" });

    expect(result.success).to.be.true;
    expect(renderStub.calledOnceWith(customers)).to.be.true;
    expect(uploadStub.calledOnceWith(pngBuffer, "image/png")).to.be.true;
    expect(sendStub.calledOnce).to.be.true;
    expect(sendStub.firstCall.args[0].mediaType).to.equal("document");
    expect(sendStub.firstCall.args[0].documentFilename).to.match(/\.png$/);
  });

  it('format "detailed" calls generateCustomersExcel, uploads xlsx, sends document with .xlsx filename', async () => {
    const customers = [minimalCustomer()];
    const uploadStub = sinon.stub().resolves("media-id");
    const sendStub = sinon.stub().resolves({ messages: [{ id: "msg-1" }] });

    const deps = {
      exportAllCustomers: sinon.stub().resolves(customers),
      renderCustomersReportToPng: sinon.stub(),
      uploadMedia: uploadStub,
      sendWhatsAppMessage: sendStub
    } as unknown as ToolExecutorDependencies;

    const result = await handleExportAllCustomers(
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
      exportAllCustomers: sinon.stub().resolves([minimalCustomer()]),
      renderCustomersReportToPng: sinon.stub(),
      uploadMedia: sinon.stub(),
      sendWhatsAppMessage: sinon.stub()
    } as unknown as ToolExecutorDependencies;

    const result = await handleExportAllCustomers(deps, {}, { phone: "+999" });

    expect(result.success).to.be.false;
    expect(result.message).to.include("admin");
  });

  it("missing adminPhone returns error", async () => {
    const deps = {
      exportAllCustomers: sinon.stub().resolves([minimalCustomer()]),
      renderCustomersReportToPng: sinon.stub(),
      uploadMedia: sinon.stub(),
      sendWhatsAppMessage: sinon.stub()
    } as unknown as ToolExecutorDependencies;

    const result = await handleExportAllCustomers(deps, {}, { userId: "admin-1" });

    expect(result.success).to.be.false;
    expect(result.message).to.include("telefono");
  });

  it("empty customers returns success with no report sent", async () => {
    const exportStub = sinon.stub().resolves([]);
    const renderStub = sinon.stub();
    const uploadStub = sinon.stub();
    const sendStub = sinon.stub();

    const deps = {
      exportAllCustomers: exportStub,
      renderCustomersReportToPng: renderStub,
      uploadMedia: uploadStub,
      sendWhatsAppMessage: sendStub
    } as unknown as ToolExecutorDependencies;

    const result = await handleExportAllCustomers(deps, {}, { userId: "admin-1", phone: "+999" });

    expect(result.success).to.be.true;
    expect(result.message).to.include("No hay clientes activos");
    expect(renderStub.called).to.be.false;
    expect(uploadStub.called).to.be.false;
    expect(sendStub.called).to.be.false;
  });

  it("upload failure returns error", async () => {
    const customers = [minimalCustomer()];
    const renderStub = sinon.stub().resolves(Buffer.from("png"));
    const uploadStub = sinon.stub().rejects(new Error("Upload failed"));

    const deps = {
      exportAllCustomers: sinon.stub().resolves(customers),
      renderCustomersReportToPng: renderStub,
      uploadMedia: uploadStub,
      sendWhatsAppMessage: sinon.stub()
    } as unknown as ToolExecutorDependencies;

    const result = await handleExportAllCustomers(deps, {}, { userId: "admin-1", phone: "+999" });

    expect(result.success).to.be.false;
    expect(result.message).to.include("Error al enviar");
    expect(result.message).to.include("Upload failed");
  });

  it("send failure returns error", async () => {
    const customers = [minimalCustomer()];
    const renderStub = sinon.stub().resolves(Buffer.from("png"));
    const uploadStub = sinon.stub().resolves("media-id");
    const sendStub = sinon.stub().rejects(new Error("Send failed"));

    const deps = {
      exportAllCustomers: sinon.stub().resolves(customers),
      renderCustomersReportToPng: renderStub,
      uploadMedia: uploadStub,
      sendWhatsAppMessage: sendStub
    } as unknown as ToolExecutorDependencies;

    const result = await handleExportAllCustomers(deps, {}, { userId: "admin-1", phone: "+999" });

    expect(result.success).to.be.false;
    expect(result.message).to.include("Error al enviar");
    expect(result.message).to.include("Send failed");
  });
});
