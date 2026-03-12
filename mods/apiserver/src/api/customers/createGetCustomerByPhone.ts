/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  getCustomerByPhoneSchema,
  type GetCustomerByPhoneInput,
  type DbClient,
  type Customer
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to get a customer by phone number.
 *
 * @param client - The database client
 * @returns A validated function that retrieves a customer by phone
 */
export function createGetCustomerByPhone(client: DbClient) {
  const fn = async (params: GetCustomerByPhoneInput): Promise<Customer | null> => {
    logger.verbose("getting customer by phone", { phone: params.phone });
    const customer = await client.customer.findFirst({
      where: { phone: params.phone },
      include: { notificationPolicy: true }
    });
    logger.verbose("customer by phone retrieved", { phone: params.phone, found: !!customer });
    return customer;
  };

  return withErrorHandlingAndValidation(fn, getCustomerByPhoneSchema);
}
