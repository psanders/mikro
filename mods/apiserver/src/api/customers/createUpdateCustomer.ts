/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  updateCustomerSchema,
  type UpdateCustomerInput,
  type DbClient,
  type Customer
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to update an existing customer.
 * Only name, nickname, phone, notes, isActive, and preferredPaymentDay can be updated.
 * Phone is validated and normalized to E.164 format via Zod schema transform if provided.
 *
 * @param client - The database client
 * @returns A validated function that updates a customer
 */
export function createUpdateCustomer(client: DbClient) {
  const fn = async (params: UpdateCustomerInput): Promise<Customer> => {
    const { id, ...updateData } = params;
    logger.verbose("updating customer", { id, fields: Object.keys(updateData) });
    const customer = await client.customer.update({
      where: { id },
      data: updateData
    });
    logger.verbose("customer updated", { id: customer.id });
    return customer;
  };

  return withErrorHandlingAndValidation(fn, updateCustomerSchema);
}
