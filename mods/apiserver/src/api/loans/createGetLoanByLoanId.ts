/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  getLoanByLoanIdSchema,
  type GetLoanByLoanIdInput,
  type DbClient,
  type Loan
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to get a loan by numeric loan ID (loanId field).
 * Includes customer relation with assignedCollectorId for validation.
 *
 * @param client - The database client
 * @returns A validated function that retrieves a loan by numeric loan ID
 */
export function createGetLoanByLoanId(client: DbClient) {
  const fn = async (
    params: GetLoanByLoanIdInput
  ): Promise<
    | (Loan & {
        customer: {
          id: string;
          name: string;
          nickname: string | null;
          phone: string;
          assignedCollectorId: string | null;
        };
      })
    | null
  > => {
    logger.verbose("getting loan by loan ID", { loanId: params.loanId });
    const loan = await client.loan.findUnique({
      where: { loanId: params.loanId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            nickname: true,
            phone: true,
            assignedCollectorId: true
          }
        }
      }
    });
    logger.verbose("loan by loan ID retrieved", { loanId: params.loanId, found: !!loan });
    return loan as
      | (Loan & {
          customer: {
            id: string;
            name: string;
            nickname: string | null;
            phone: string;
            assignedCollectorId: string | null;
          };
        })
      | null;
  };

  return withErrorHandlingAndValidation(fn, getLoanByLoanIdSchema);
}
