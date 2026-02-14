/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  exportAllMembersSchema,
  type ExportAllMembersInput,
  type DbClient,
  type MemberWithLoansAndReferrer
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to export all active members with loans and referrer.
 * Returns all active members with active loans, completed payments, and referrer info for report generation.
 * This is an admin-only operation.
 *
 * @param client - The database client
 * @returns A validated function that exports all members
 */
export function createExportAllMembers(client: DbClient) {
  const fn = async (_: ExportAllMembersInput): Promise<MemberWithLoansAndReferrer[]> => {
    logger.verbose("exporting all members");

    const members = await client.member.findMany({
      where: {
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

    logger.verbose("all members exported", {
      memberCount: members.length,
      loanCount: members.reduce((acc, m) => acc + m.loans.length, 0)
    });

    return members;
  };

  return withErrorHandlingAndValidation(fn, exportAllMembersSchema);
}
