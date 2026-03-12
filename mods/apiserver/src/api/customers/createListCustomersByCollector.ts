/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listCustomersByCollectorSchema,
  type ListCustomersByCollectorInput,
  type DbClient,
  type Customer
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to list customers by assigned collector ID.
 * By default, only returns active customers unless showInactive is true.
 *
 * @param client - The database client
 * @returns A validated function that lists customers by collector
 */
export function createListCustomersByCollector(client: DbClient) {
  const fn = async (params: ListCustomersByCollectorInput): Promise<Customer[]> => {
    logger.verbose("listing customers by collector", { collectorId: params.assignedCollectorId });
    const customers = await client.customer.findMany({
      where: {
        assignedCollectorId: params.assignedCollectorId,
        ...(params.showInactive ? {} : { isActive: true })
      },
      include: { notificationPolicy: true },
      take: params.limit,
      skip: params.offset
    });
    logger.verbose("customers by collector listed", {
      collectorId: params.assignedCollectorId,
      count: customers.length
    });
    return customers;
  };

  return withErrorHandlingAndValidation(fn, listCustomersByCollectorSchema);
}
