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
import { logger } from "../../logger.js";

export interface GeneratedContract {
  dataBase64: string;
  filename: string;
  mimeType: "application/pdf";
}

/**
 * Render an ad-hoc loan contract PDF for an existing customer. Debtor identity
 * comes from the customer row; the debtor's gender and the negotiated terms come
 * from the founder (copilot contract form). Stateless — persists no PDF and
 * changes no record. The `contract.generated` feed event is written by the
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
    logger.verbose("generated customer contract", { customerId: customer.id, bytes: pdf.length });

    return {
      dataBase64: pdf.toString("base64"),
      filename: `contrato-${customer.id.slice(0, 8)}.pdf`,
      mimeType: "application/pdf"
    };
  };

  return withErrorHandlingAndValidation(fn, generateCustomerContractSchema);
}
