/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listApplicationsSchema,
  AD_ATTRIBUTION_START,
  type ApplicationOrigin,
  type ListApplicationsInput,
  type DbClient,
  type LoanApplication
} from "@mikro/common";
import { logger } from "../../logger.js";

/** The `where` that matches one origin — mirrors `applicationOrigin()` in common. */
function originWhere(origin: ApplicationOrigin) {
  switch (origin) {
    case "ad":
      return { source: "FORM" as const, adId: { not: null } };
    case "organic":
      return { source: "FORM" as const, adId: null, createdAt: { gte: AD_ATTRIBUTION_START } };
    case "unknown":
      return { source: "FORM" as const, adId: null, createdAt: { lt: AD_ATTRIBUTION_START } };
    case "whatsapp":
      return { source: "WHATSAPP" as const };
    case "manual":
      return { source: "MANUAL" as const };
  }
}

/**
 * Creates a function to list loan applications, newest first, with optional
 * status and origin filters and pagination. For internal dashboard use.
 *
 * @param client - The database client
 * @returns A validated function that lists applications
 */
export function createListApplications(client: DbClient) {
  const fn = async (params: ListApplicationsInput): Promise<LoanApplication[]> => {
    logger.verbose("listing loan applications", {
      status: params.status,
      origin: params.origin,
      limit: params.limit,
      offset: params.offset
    });
    const applications = await client.loanApplication.findMany({
      where: {
        ...(params.status && { status: params.status }),
        ...(params.origin && originWhere(params.origin))
      },
      orderBy: { createdAt: "desc" },
      take: params.limit,
      skip: params.offset
    });
    logger.verbose("loan applications listed", { count: applications.length });
    return applications;
  };

  return withErrorHandlingAndValidation(fn, listApplicationsSchema);
}
