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
    logger.verbose("listing customers", {
      search: params.search,
      limit: params.limit,
      offset: params.offset
    });
    const where: Record<string, unknown> = {};
    if (!params.showInactive) where.isActive = true;
    if (params.search) {
      where.OR = [
        { name: { contains: params.search } },
        { nickname: { contains: params.search } },
        { phone: { contains: params.search } }
      ];
    }
    const customers = await client.customer.findMany({
      where,
      take: params.limit ?? 20,
      skip: params.offset
    });
    logger.verbose("customers listed", { count: customers.length });
    return customers;
  };

  return withErrorHandlingAndValidation(fn, listCustomersSchema);
}
