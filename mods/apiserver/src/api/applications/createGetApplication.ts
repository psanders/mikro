/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  getApplicationSchema,
  type GetApplicationInput,
  type DbClient,
  type LoanApplication
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to fetch a single loan application by id or sessionId.
 * For internal dashboard use.
 *
 * @param client - The database client
 * @returns A validated function that returns the application or null
 */
export function createGetApplication(client: DbClient) {
  const fn = async (params: GetApplicationInput): Promise<LoanApplication | null> => {
    logger.verbose("getting loan application", { id: params.id, sessionId: params.sessionId });
    if (params.id) {
      return client.loanApplication.findUnique({ where: { id: params.id } });
    }
    return client.loanApplication.findFirst({ where: { sessionId: params.sessionId! } });
  };

  return withErrorHandlingAndValidation(fn, getApplicationSchema);
}
