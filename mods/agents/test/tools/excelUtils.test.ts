/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import ExcelJS from "exceljs";
import {
  generateCustomersExcel,
  generateFilename,
  type ExportedCustomer
} from "../../src/tools/executor/excelUtils.js";

describe("excelUtils", () => {
  describe("generateFilename", () => {
    let clock: sinon.SinonFakeTimers;

    afterEach(() => {
      if (clock) clock.restore();
    });

    it("should generate filename with default prefix and current date", () => {
      clock = sinon.useFakeTimers(new Date("2026-03-15"));
      const filename = generateFilename();
      expect(filename).to.equal("reporte-clientes-2026-03-15.xlsx");
    });

    it("should generate filename with custom prefix", () => {
      clock = sinon.useFakeTimers(new Date("2026-03-15"));
      const filename = generateFilename("reporte-cobrador");
      expect(filename).to.equal("reporte-cobrador-2026-03-15.xlsx");
    });

    it("should generate filename with referidos prefix", () => {
      clock = sinon.useFakeTimers(new Date("2026-03-15"));
      const filename = generateFilename("reporte-referidos");
      expect(filename).to.equal("reporte-referidos-2026-03-15.xlsx");
    });
  });

  describe("generateCustomersExcel", function () {
    // Excel generation can be slow, increase timeout
    this.timeout(10000);

    const createMockCustomer = (name: string, loanCount = 1): ExportedCustomer => ({
      name,
      phone: "+18091234567",
      collectionPoint: "https://maps.google.com/place",
      notes: "Test notes",
      referredBy: { name: "John Referrer" },
      loans: Array(loanCount)
        .fill(null)
        .map((_, i) => ({
          loanId: 10001 + i,
          notes: null,
          paymentFrequency: "WEEKLY",
          createdAt: new Date("2026-01-01"),
          termLength: 10,
          payments: [{ paidAt: new Date("2026-01-08") }]
        }))
    });

    it("should generate a valid Excel buffer", async () => {
      const customers = [createMockCustomer("John Doe")];
      const result = await generateCustomersExcel(customers);

      expect(result.buffer).to.be.instanceOf(Buffer);
      expect(result.buffer.length).to.be.greaterThan(0);
    });

    it("should include correct filename format with prefix", async () => {
      const customers = [createMockCustomer("John Doe")];
      const result = await generateCustomersExcel(customers, "reporte-cobrador");

      // Check filename format without date dependency
      expect(result.filename).to.match(/^reporte-cobrador-\d{4}-\d{2}-\d{2}\.xlsx$/);
    });

    it("should return correct customer count", async () => {
      const customers = [
        createMockCustomer("John Doe"),
        createMockCustomer("Jane Smith"),
        createMockCustomer("Bob Wilson")
      ];
      const result = await generateCustomersExcel(customers);

      expect(result.customerCount).to.equal(3);
    });

    it("should return correct loan count", async () => {
      const customers = [
        createMockCustomer("John Doe", 2), // 2 loans
        createMockCustomer("Jane Smith", 1), // 1 loan
        createMockCustomer("Bob Wilson", 3) // 3 loans
      ];
      const result = await generateCustomersExcel(customers);

      expect(result.loanCount).to.equal(6);
    });

    it("should handle empty customers array", async () => {
      const result = await generateCustomersExcel([]);

      expect(result.customerCount).to.equal(0);
      expect(result.loanCount).to.equal(0);
      expect(result.buffer).to.be.instanceOf(Buffer);
    });

    it("should handle customers with no loans", async () => {
      const customerNoLoans: ExportedCustomer = {
        name: "John Doe",
        phone: "+18091234567",
        collectionPoint: null,
        notes: null,
        referredBy: { name: "Referrer" },
        loans: []
      };
      const result = await generateCustomersExcel([customerNoLoans]);

      expect(result.customerCount).to.equal(1);
      expect(result.loanCount).to.equal(0);
    });

    it("should handle null collectionPoint and notes", async () => {
      const customer: ExportedCustomer = {
        name: "John Doe",
        phone: "+18091234567",
        collectionPoint: null,
        notes: null,
        referredBy: { name: "Referrer" },
        loans: [
          {
            loanId: 10001,
            notes: null,
            paymentFrequency: "WEEKLY",
            createdAt: new Date("2026-01-01"),
            termLength: 10,
            payments: []
          }
        ]
      };
      const result = await generateCustomersExcel([customer]);

      // Should not throw and should generate valid buffer
      expect(result.buffer).to.be.instanceOf(Buffer);
      expect(result.buffer.length).to.be.greaterThan(0);
    });

    it("should create valid Excel structure with headers", async () => {
      const customers = [createMockCustomer("John Doe")];
      const result = await generateCustomersExcel(customers);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(result.buffer);

      const worksheet = workbook.getWorksheet("Reporte de Clientes");
      expect(worksheet).to.exist;

      const headerRow = worksheet!.getRow(1);
      expect(headerRow.getCell(1).value).to.equal("Nombre");
      expect(headerRow.getCell(2).value).to.equal("Teléfono");
      expect(headerRow.getCell(3).value).to.equal("Préstamo");
      expect(headerRow.getCell(4).value).to.equal("Ciclo de Pago");
      expect(headerRow.getCell(5).value).to.equal("Rating");
      expect(headerRow.getCell(6).value).to.equal("Pagos atrasados");
      expect(headerRow.getCell(7).value).to.equal("Tendencia");
      expect(headerRow.getCell(8).value).to.equal("Lugar de Cobro");
      expect(headerRow.getCell(9).value).to.equal("Notas");
    });

    it("should include customer data in rows", async () => {
      const customers = [createMockCustomer("John Doe")];
      const result = await generateCustomersExcel(customers);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(result.buffer);

      const worksheet = workbook.getWorksheet("Reporte de Clientes");
      expect(worksheet).to.exist;

      const dataRow = worksheet!.getRow(2);
      expect(dataRow.getCell(1).value).to.equal("John Doe");
      expect(dataRow.getCell(2).value).to.equal("+18091234567");
      expect(dataRow.getCell(3).value).to.equal(10001);
      expect(dataRow.getCell(4).value).to.equal("Semanal");
      expect(dataRow.getCell(5).value).to.match(/^★+$/);
    });

    it("should sort rows by rating ascending then missed count descending", async () => {
      const now = new Date();
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const start = new Date(now.getTime() - 5 * msPerWeek);
      const pay = (weeksFromStart: number) =>
        new Date(start.getTime() + weeksFromStart * msPerWeek);

      const customers: ExportedCustomer[] = [
        {
          name: "On time",
          phone: "+1",
          collectionPoint: null,
          notes: null,
          referredBy: { name: "R" },
          loans: [
            {
              loanId: 1,
              notes: null,
              paymentFrequency: "WEEKLY",
              createdAt: start,
              termLength: 10,
              payments: [pay(1), pay(2), pay(3), pay(4), pay(5)].map((paidAt) => ({ paidAt }))
            }
          ]
        },
        {
          name: "Two behind",
          phone: "+2",
          collectionPoint: null,
          notes: null,
          referredBy: { name: "R" },
          loans: [
            {
              loanId: 2,
              notes: null,
              paymentFrequency: "WEEKLY",
              createdAt: start,
              termLength: 10,
              payments: [pay(3), pay(4), pay(5)].map((paidAt) => ({ paidAt }))
            }
          ]
        }
      ];
      const result = await generateCustomersExcel(customers);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(result.buffer);
      const worksheet = workbook.getWorksheet("Reporte de Clientes")!;
      const row2 = worksheet.getRow(2);
      const row3 = worksheet.getRow(3);
      expect(row2.getCell(1).value).to.equal("Two behind");
      expect(row3.getCell(1).value).to.equal("On time");
    });
  });
});
