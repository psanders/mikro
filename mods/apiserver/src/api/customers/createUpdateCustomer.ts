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
 * Only name, phone, note, and isActive can be updated.
 * Phone is validated and normalized to E.164 format via Zod schema transform if provided.
 *
 * @param client - The database client
 * @returns A validated function that updates a customer
 */
export function createUpdateCustomer(client: DbClient) {
  const fn = async (params: UpdateCustomerInput): Promise<Customer> => {
    const { id, notificationPolicy, ...updateData } = params;
    logger.verbose("updating customer", { id, fields: Object.keys(updateData) });
    const data = {
      ...updateData,
      ...(notificationPolicy && {
        notificationPolicy: {
          upsert: {
            create: { collections: true, paymentConfirmations: true, ...notificationPolicy },
            update: notificationPolicy
          }
        }
      })
    };
    const customer = await (
      client as {
        customer: {
          update: (args: { where: { id: string }; data: typeof data }) => Promise<Customer>;
        };
      }
    ).customer.update({
      where: { id },
      data
    });
    logger.verbose("customer updated", { id: customer.id });
    return customer;
  };

  return withErrorHandlingAndValidation(fn, updateCustomerSchema);
}
