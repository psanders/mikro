/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  exportCollectorMembersSchema,
  type ExportCollectorMembersInput,
  type DbClient,
  type MemberWithLoansAndReferrer
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to export members by collector ID with loans and referrer.
 * Returns members with active loans, all completed payments, and referrer info for CSV generation.
 *
 * @param client - The database client
 * @returns A validated function that exports collector members
 */
export function createExportCollectorMembers(client: DbClient) {
  const fn = async (params: ExportCollectorMembersInput): Promise<MemberWithLoansAndReferrer[]> => {
    logger.verbose("exporting members by collector", { collectorId: params.assignedCollectorId });

    const members = await client.member.findMany({
      where: {
        assignedCollectorId: params.assignedCollectorId,
        isActive: true
      },
      include: {
        loans: {
          where: { status: "ACTIVE" },
          include: {
            payments: {
              where: { status: "COMPLETED" },
              orderBy: { paidAt: "desc" }
              // Need all completed payments for payment status calculation
            }
          }
        },
        referredBy: { select: { name: true } }
      }
    });

    logger.verbose("members exported for collector", {
      collectorId: params.assignedCollectorId,
      memberCount: members.length,
      loanCount: members.reduce((acc, m) => acc + m.loans.length, 0)
    });

    return members;
  };

  return withErrorHandlingAndValidation(fn, exportCollectorMembersSchema);
}
