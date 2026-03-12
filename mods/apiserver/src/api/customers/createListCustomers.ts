/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listCustomersSchema,
  type ListCustomersInput,
  type DbClient,
  type Customer
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to list all customers with optional pagination.
 * By default, only returns active customers unless showInactive is true.
 *
 * @param client - The database client
 * @returns A validated function that lists customers
 */
export function createListCustomers(client: DbClient) {
  const fn = async (params: ListCustomersInput): Promise<Customer[]> => {
    logger.verbose("listing customers", { limit: params.limit, offset: params.offset });
    const customers = await client.customer.findMany({
      where: params.showInactive ? undefined : { isActive: true },
      include: { notificationPolicy: true },
      take: params.limit,
      skip: params.offset
    });
    logger.verbose("customers listed", { count: customers.length });
    return customers;
  };

  return withErrorHandlingAndValidation(fn, listCustomersSchema);
}
