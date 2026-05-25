/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listCustomersByReferrerSchema,
  type ListCustomersByReferrerInput,
  type DbClient,
  type Customer
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to list customers by referrer ID.
 * By default, only returns active customers unless showInactive is true.
 *
 * @param client - The database client
 * @returns A validated function that lists customers by referrer
 */
export function createListCustomersByReferrer(client: DbClient) {
  const fn = async (params: ListCustomersByReferrerInput): Promise<Customer[]> => {
    logger.verbose("listing customers by referrer", { referrerId: params.referredById });
    const customers = await client.customer.findMany({
      where: {
        referredById: params.referredById,
        ...(params.showInactive ? {} : { isActive: true })
      },
      take: params.limit,
      skip: params.offset
    });
    logger.verbose("customers by referrer listed", {
      referrerId: params.referredById,
      count: customers.length
    });
    return customers;
  };

  return withErrorHandlingAndValidation(fn, listCustomersByReferrerSchema);
}
