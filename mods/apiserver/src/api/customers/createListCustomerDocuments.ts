/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listCustomerDocumentsSchema,
  type ListCustomerDocumentsInput,
  type DbClient,
  type CustomerDocument
} from "@mikro/common";

/** List a customer's documents, most-recent-first. */
export function createListCustomerDocuments(client: DbClient) {
  const fn = async (params: ListCustomerDocumentsInput): Promise<CustomerDocument[]> => {
    return client.customerDocument.findMany({
      where: { customerId: params.customerId },
      orderBy: { createdAt: "desc" }
    });
  };

  return withErrorHandlingAndValidation(fn, listCustomerDocumentsSchema);
}
