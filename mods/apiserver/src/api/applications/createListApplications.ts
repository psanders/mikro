/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listApplicationsSchema,
  type ListApplicationsInput,
  type DbClient,
  type LoanApplication
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to list loan applications, newest first, with an optional
 * status filter and pagination. For internal dashboard use.
 *
 * @param client - The database client
 * @returns A validated function that lists applications
 */
export function createListApplications(client: DbClient) {
  const fn = async (params: ListApplicationsInput): Promise<LoanApplication[]> => {
    logger.verbose("listing loan applications", {
      status: params.status,
      limit: params.limit,
      offset: params.offset
    });
    const applications = await client.loanApplication.findMany({
      where: params.status ? { status: params.status } : undefined,
      orderBy: { createdAt: "desc" },
      take: params.limit,
      skip: params.offset
    });
    logger.verbose("loan applications listed", { count: applications.length });
    return applications;
  };

  return withErrorHandlingAndValidation(fn, listApplicationsSchema);
}
