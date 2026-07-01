/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listCustomerTagsSchema,
  type ListCustomerTagsInput,
  type DbClient,
  type CustomerTag
} from "@mikro/common";

/** List every tag (AUTO + MANUAL) currently on a customer. */
export function createListCustomerTags(client: DbClient) {
  const fn = async (params: ListCustomerTagsInput): Promise<CustomerTag[]> => {
    return client.customerTag.findMany({ where: { customerId: params.customerId } });
  };

  return withErrorHandlingAndValidation(fn, listCustomerTagsSchema);
}
