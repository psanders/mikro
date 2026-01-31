/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  exportMembersByReferrerSchema,
  type ExportMembersByReferrerInput,
  type DbClient,
  type MemberWithLoansAndReferrer
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to export members by referrer ID with loans and referrer.
 * Returns members with active loans, all completed payments, and referrer info for report generation.
 *
 * @param client - The database client
 * @returns A validated function that exports members by referrer
 */
export function createExportMembersByReferrer(client: DbClient) {
  const fn = async (
    params: ExportMembersByReferrerInput
  ): Promise<MemberWithLoansAndReferrer[]> => {
    logger.verbose("exporting members by referrer", { referrerId: params.referredById });

    const members = await client.member.findMany({
      where: {
        referredById: params.referredById,
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

    logger.verbose("members exported for referrer", {
      referrerId: params.referredById,
      memberCount: members.length,
      loanCount: members.reduce((acc, m) => acc + m.loans.length, 0)
    });

    return members;
  };

  return withErrorHandlingAndValidation(fn, exportMembersByReferrerSchema);
}
