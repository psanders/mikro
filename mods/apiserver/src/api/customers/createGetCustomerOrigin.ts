/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  getCustomerSchema,
  applicationOrigin,
  type GetCustomerInput,
  type ApplicationOrigin
} from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { logger } from "../../logger.js";

/**
 * Creates a function that returns where a customer came from: the origin of
 * the application converted into them (the most recent, if several). Null when
 * no converted application links to the customer (openspec
 * add-application-origin).
 *
 * @param client - The database client
 * @returns A validated function that resolves the customer's origin
 */
export function createGetCustomerOrigin(client: PrismaClient) {
  const fn = async (params: GetCustomerInput): Promise<{ origin: ApplicationOrigin | null }> => {
    const app = await client.loanApplication.findFirst({
      where: { customerId: params.id, status: "CONVERTED" },
      orderBy: { createdAt: "desc" },
      select: { source: true, adId: true, createdAt: true }
    });
    logger.verbose("customer origin resolved", { id: params.id, found: !!app });
    return { origin: app ? applicationOrigin(app) : null };
  };

  return withErrorHandlingAndValidation(fn, getCustomerSchema);
}
