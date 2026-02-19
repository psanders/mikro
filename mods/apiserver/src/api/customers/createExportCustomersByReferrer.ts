/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  exportCustomersByReferrerSchema,
  type ExportCustomersByReferrerInput,
  type DbClient,
  type CustomerWithLoansAndReferrer
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to export customers by referrer ID with loans and referrer.
 * Returns customers with active loans, all completed payments, and referrer info for report generation.
 *
 * @param client - The database client
 * @returns A validated function that exports customers by referrer
 */
export function createExportCustomersByReferrer(client: DbClient) {
  const fn = async (
    params: ExportCustomersByReferrerInput
  ): Promise<CustomerWithLoansAndReferrer[]> => {
    logger.verbose("exporting customers by referrer", { referrerId: params.referredById });

    const customers = await client.customer.findMany({
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

    logger.verbose("customers exported for referrer", {
      referrerId: params.referredById,
      customerCount: customers.length,
      loanCount: customers.reduce((acc, m) => acc + m.loans.length, 0)
    });

    return customers;
  };

  return withErrorHandlingAndValidation(fn, exportCustomersByReferrerSchema);
}
