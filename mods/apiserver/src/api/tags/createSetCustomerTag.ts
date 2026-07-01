/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  setCustomerTagSchema,
  type SetCustomerTagInput,
  type DbClient,
  type CustomerTag
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Set (create or refresh) a MANUAL risk: tag on a customer. Source is always
 * MANUAL — only the tag engine sets AUTO tags. Idempotent: setting an already
 * present tag just refreshes setAt.
 */
export function createSetCustomerTag(client: DbClient) {
  const fn = async (params: SetCustomerTagInput): Promise<CustomerTag> => {
    const customer = await client.customer.findUnique({ where: { id: params.customerId } });
    if (!customer) {
      throw new Error(`Customer not found: ${params.customerId}`);
    }

    const tag = await client.customerTag.upsert({
      where: { customerId_tag: { customerId: params.customerId, tag: params.tag } },
      create: { customerId: params.customerId, tag: params.tag, source: "MANUAL" },
      update: { source: "MANUAL", setAt: new Date() }
    });

    logger.info("manual customer tag set", { customerId: params.customerId, tag: params.tag });
    return tag;
  };

  return withErrorHandlingAndValidation(fn, setCustomerTagSchema);
}
