/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  exportAllCustomersSchema,
  type ExportAllCustomersInput,
  type DbClient,
  type CustomerWithLoansAndReferrer
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to export all active customers with loans and referrer.
 * Returns all active customers with active loans, completed payments, and referrer info for report generation.
 * This is an admin-only operation.
 *
 * @param client - The database client
 * @returns A validated function that exports all customers
 */
export function createExportAllCustomers(client: DbClient) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature required by schema
  const fn = async (_input: ExportAllCustomersInput): Promise<CustomerWithLoansAndReferrer[]> => {
    logger.verbose("exporting all customers");

    const customers = await client.customer.findMany({
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

    logger.verbose("all customers exported", {
      customerCount: customers.length,
      loanCount: customers.reduce((acc, m) => acc + m.loans.length, 0)
    });

    return customers;
  };

  return withErrorHandlingAndValidation(fn, exportAllCustomersSchema);
}
