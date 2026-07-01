/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  clearCustomerTagSchema,
  type ClearCustomerTagInput,
  type DbClient
} from "@mikro/common";
import { logger } from "../../logger.js";

export interface ClearCustomerTagResult {
  customerId: string;
  tag: string;
  removed: boolean;
}

/**
 * Clear a MANUAL risk: tag from a customer. Only ever removes MANUAL tags —
 * the source filter means an AUTO tag with the same string (impossible today
 * since status:/dpd: and risk: namespaces never collide) could never be
 * removed through this path.
 */
export function createClearCustomerTag(client: DbClient) {
  const fn = async (params: ClearCustomerTagInput): Promise<ClearCustomerTagResult> => {
    const { count } = await client.customerTag.deleteMany({
      where: { customerId: params.customerId, tag: params.tag, source: "MANUAL" }
    });

    logger.info("manual customer tag cleared", {
      customerId: params.customerId,
      tag: params.tag,
      removed: count > 0
    });

    return { customerId: params.customerId, tag: params.tag, removed: count > 0 };
  };

  return withErrorHandlingAndValidation(fn, clearCustomerTagSchema);
}
