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

type ContractCustomer = Parameters<typeof buildContractDataFromCustomer>[0] & {
  id: string;
  name: string | null;
  idNumber: string | null;
};

/** A rendered contract already written to contract storage (content-addressed). */
export interface StoredContract extends GeneratedContract {
  saved: ReturnType<typeof saveContract>;
}

/**
 * Render a customer's contract PDF and write it to contract storage. Shared by
 * `generateCustomerContract` and `renewLoan`; the caller records the
 * `CustomerDocument` row (inside its own transaction when it has one). The file
 * is stored by sha256, so a rolled-back caller leaves at most an unreferenced
 * file, never a dangling row.
 */
export async function renderAndStoreCustomerContract(
  customer: ContractCustomer,
  terms: Parameters<typeof buildContractDataFromCustomer>[1]
): Promise<StoredContract> {
  if (!customer.name || !customer.idNumber) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The customer is missing a name or cédula."
    });
  }
  const data = buildContractDataFromCustomer(customer, terms);
  const pdf = await renderContractPdf(data);
  const dataBase64 = pdf.toString("base64");
  const filename = `contrato-${customer.id.slice(0, 8)}.pdf`;
  const saved = saveContract({ dataBase64 });
  return { dataBase64, filename, mimeType: "application/pdf", saved };
}

/**
 * Render an ad-hoc loan contract PDF for an existing customer. Debtor identity
 * comes from the customer row; the negotiated terms come from the founder
 * (copilot contract form). The contract text is gender-neutral. The rendered
 * PDF is persisted as a
 * `CustomerDocument` (`type: CONTRACT`, `source: DIRECT`) before returning, so
 * the digital record is durably captured for auditing even though the response
 * is download-only. No feed event is written for this: generating a contract is
 * part of creating a loan, which the `loan.created` event already covers (the
 * standalone `contract.generated` event was retired as redundant noise).
 */
export function createGenerateCustomerContract(client: DbClient) {
  const fn = async (input: GenerateCustomerContractInput): Promise<GeneratedContract> => {
    const customer = await client.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
    }
    const { dataBase64, filename, saved } = await renderAndStoreCustomerContract(customer, input);
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
      bytes: saved.size,
      sha256: saved.sha256
    });

    return { dataBase64, filename, mimeType: "application/pdf" };
  };

  return withErrorHandlingAndValidation(fn, generateCustomerContractSchema);
}
