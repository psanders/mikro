/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  getCustomerSchema,
  type GetCustomerInput,
  type DbClient,
  type Customer
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to get a customer by ID.
 *
 * @param client - The database client
 * @returns A validated function that retrieves a customer
 */
export function createGetCustomer(client: DbClient) {
  const fn = async (params: GetCustomerInput): Promise<Customer | null> => {
    logger.verbose("getting customer", { id: params.id });
    const customer = await client.customer.findUnique({
      where: { id: params.id }
    });
    logger.verbose("customer retrieved", { id: params.id, found: !!customer });
    return customer;
  };

  return withErrorHandlingAndValidation(fn, getCustomerSchema);
}
