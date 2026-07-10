/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  generateCustomerContractSchema,
  type GenerateCustomerContractInput,
  type DbClient
} from "@mikro/common";
import { renderContractPdf, buildContractDataFromCustomer } from "@mikro/common/contracts";
import { TRPCError } from "@trpc/server";
import { saveContract } from "../../applications/storage.js";
import { logger } from "../../logger.js";

export interface GeneratedContract {
  dataBase64: string;
  filename: string;
  mimeType: "application/pdf";
}

/**
 * Render an ad-hoc loan contract PDF for an existing customer. Debtor identity
 * comes from the customer row; the debtor's gender and the negotiated terms come
 * from the founder (copilot contract form). The rendered PDF is persisted as a
 * `CustomerDocument` (`type: CONTRACT`, `source: DIRECT`) before returning, so
 * the digital record is durably captured for auditing even though the response
 * is download-only. The `contract.generated` feed event is written by the
 * event-capture middleware after the procedure succeeds, not here.
 */
export function createGenerateCustomerContract(client: DbClient) {
  const fn = async (input: GenerateCustomerContractInput): Promise<GeneratedContract> => {
    const customer = await client.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
    }
    if (!customer.name || !customer.idNumber) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "The customer is missing a name or cédula."
      });
    }

    const data = buildContractDataFromCustomer(customer, input);
    const pdf = await renderContractPdf(data);
    const dataBase64 = pdf.toString("base64");
    const filename = `contrato-${customer.id.slice(0, 8)}.pdf`;

    const saved = saveContract({ dataBase64 });
    await client.customerDocument.create({
      data: {
        type: "CONTRACT",
        filename: saved.filename,
        originalName: filename,
        mimeType: "application/pdf",
        size: saved.size,
        sha256: saved.sha256,
        source: "DIRECT",
        customerId: customer.id
      }
    });

    logger.verbose("generated customer contract", {
      customerId: customer.id,
      bytes: pdf.length,
      sha256: saved.sha256
    });

    return { dataBase64, filename, mimeType: "application/pdf" };
  };

  return withErrorHandlingAndValidation(fn, generateCustomerContractSchema);
}
