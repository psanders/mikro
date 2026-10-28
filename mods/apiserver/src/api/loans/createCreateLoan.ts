/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  createLoanSchema,
  snapFirstDueDate,
  type CreateLoanInput,
  type DbClient,
  type Loan,
  type PaymentFrequency
} from "@mikro/common";
import { logger } from "../../logger.js";

/** Which creation path supplied the first cuota date (logged). */
export type FirstDueSource = "contractTerms" | "renewal" | "createLoan";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * The legacy cycle anchor one period before `firstDueDate`: −1 d / −7 d / −14 d /
 * −1 month (day clamped to the shorter month). Stored as `startingDate` so a
 * rollback to an engine that ignores `firstDueDate` still reads the loan sensibly.
 */
export function previousPeriod(firstDueDate: Date, freq: PaymentFrequency): Date {
  switch (freq) {
    case "DAILY":
      return new Date(firstDueDate.getTime() - MS_PER_DAY);
    case "BIWEEKLY":
      return new Date(firstDueDate.getTime() - 14 * MS_PER_DAY);
    case "MONTHLY": {
      const year = firstDueDate.getUTCFullYear();
      const month = firstDueDate.getUTCMonth() - 1;
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      return new Date(Date.UTC(year, month, Math.min(firstDueDate.getUTCDate(), lastDay)));
    }
    case "WEEKLY":
    default:
      return new Date(firstDueDate.getTime() - 7 * MS_PER_DAY);
  }
}

/**
 * Creates a function to create a new loan.
 * Generates a unique loanId (sequential integer starting at 10000).
 *
 * With `firstDueDate`, the loan is due on exactly that date (snapped for
 * BIWEEKLY) and `startingDate` defaults to the anchor one period earlier.
 * Without it, `startingDate` is stored as given and `firstDueDate` stays null.
 *
 * @param client - The database client
 * @param source - The creation path, for the `loan first due set` log
 * @returns A validated function that creates a loan
 */
export function createCreateLoan(client: DbClient, source: FirstDueSource = "createLoan") {
  const fn = async (params: CreateLoanInput): Promise<Loan> => {
    logger.verbose("creating loan", {
      customerId: params.customerId,
      principal: params.principal.toString()
    });

    // Get the next loan ID (start at 10000 if no loans exist)
    const lastLoan = await client.loan.findFirst({
      orderBy: { loanId: "desc" },
      select: { loanId: true }
    });
    const nextLoanId = lastLoan ? lastLoan.loanId + 1 : 10000;

    const firstDueDate = params.firstDueDate
      ? snapFirstDueDate(params.firstDueDate, params.paymentFrequency)
      : null;
    const startingDate =
      params.startingDate ??
      (firstDueDate ? previousPeriod(firstDueDate, params.paymentFrequency) : null);

    const loan = (await client.loan.create({
      data: {
        loanId: nextLoanId,
        customerId: params.customerId,
        principal: params.principal,
        termLength: params.termLength,
        paymentAmount: params.paymentAmount,
        paymentFrequency: params.paymentFrequency,
        startingDate,
        firstDueDate,
        nickname: params.nickname ?? null,
        type: params.type ?? "SAN",
        moraRate: params.moraRate ?? null
      }
    })) as unknown as Loan;

    if (firstDueDate) {
      logger.info("loan first due set", {
        loanId: nextLoanId,
        frequency: params.paymentFrequency,
        requested: params.firstDueDate!.toISOString(),
        firstDueDate: firstDueDate.toISOString(),
        source
      });
    }

    logger.verbose("loan created", {
      id: loan.id,
      loanId: nextLoanId,
      customerId: params.customerId
    });
    return loan;
  };

  return withErrorHandlingAndValidation(fn, createLoanSchema);
}
