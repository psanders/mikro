/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  exportCollectorCustomersSchema,
  type ExportCollectorCustomersInput,
  type DbClient,
  type CustomerWithLoansAndReferrer
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to export customers by collector ID with loans and referrer.
 * Returns customers with active loans, all completed payments, and referrer info for report generation.
 *
 * @param client - The database client
 * @returns A validated function that exports collector customers
 */
export function createExportCollectorCustomers(client: DbClient) {
  const fn = async (
    params: ExportCollectorCustomersInput
  ): Promise<CustomerWithLoansAndReferrer[]> => {
    logger.verbose("exporting customers by collector", { collectorId: params.assignedCollectorId });

    const customers = await client.customer.findMany({
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

    logger.verbose("customers exported for collector", {
      collectorId: params.assignedCollectorId,
      customerCount: customers.length,
      loanCount: customers.reduce((acc, m) => acc + m.loans.length, 0)
    });

    return customers;
  };

  return withErrorHandlingAndValidation(fn, exportCollectorCustomersSchema);
}
