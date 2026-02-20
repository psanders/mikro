/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { createGenerateReceiptFromDataApi } from "../../src/api/receipts/createGenerateReceiptFromData.js";
import { ValidationError } from "@mikro/common";

describe("createGenerateReceiptFromDataApi", () => {
  describe("with invalid input", () => {
    it("should throw ValidationError when loanNumber is missing", async () => {
      const fn = createGenerateReceiptFromDataApi({
        keysDir: "/nonexistent",
        assetsDir: "/nonexistent"
      });

      try {
        await fn({
          name: "Test",
          date: "01/01/2026",
          amountPaid: "RD$ 500",
          pendingPayments: 3,
          paymentNumber: "P1"
        } as any);
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
      }
    });

    it("should throw ValidationError when pendingPayments is not a number", async () => {
      const fn = createGenerateReceiptFromDataApi({
        keysDir: "/nonexistent",
        assetsDir: "/nonexistent"
      });

      try {
        await fn({
          loanNumber: "123",
          name: "Test",
          date: "01/01/2026",
          amountPaid: "RD$ 500",
          pendingPayments: "three" as any,
          paymentNumber: "P1"
        });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
      }
    });
  });
});
