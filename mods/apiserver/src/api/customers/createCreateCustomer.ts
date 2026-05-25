/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  createCustomerSchema,
  type CreateCustomerInput,
  type DbClient,
  type Customer
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to create a new customer.
 * Phone is validated and normalized to E.164 format via Zod schema transform.
 * Referrer and collector are required.
 *
 * @param client - The database client
 * @returns A validated function that creates a customer
 */
export function createCreateCustomer(client: DbClient) {
  const fn = async (params: CreateCustomerInput): Promise<Customer> => {
    logger.verbose("creating customer", { phone: params.phone, name: params.name });
    const customer = await client.customer.create({
      data: params
    });
    logger.verbose("customer created", { id: customer.id, phone: customer.phone });
    return customer;
  };

  return withErrorHandlingAndValidation(fn, createCustomerSchema);
}
