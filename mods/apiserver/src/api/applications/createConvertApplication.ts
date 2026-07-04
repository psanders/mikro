/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { resolveReviewTransition } from "@mikro/common";
import type { DbClient, LoanApplication, ConvertApplicationInput } from "@mikro/common";
import { TRPCError } from "@trpc/server";
import { createCreateCustomer } from "../customers/createCreateCustomer.js";
import { createCreateLoan } from "../loans/createCreateLoan.js";
import { logger } from "../../logger.js";

const CEDULA_RE = /^\d{3}-\d{7}-\d{1}$/;

export interface ConvertApplicationResult {
  application: LoanApplication;
  customerId: string;
  loanId: number;
  reusedCustomer: boolean;
}

async function loadByRef(
  client: DbClient,
  ref: { id?: string; sessionId?: string }
): Promise<LoanApplication> {
  const app = ref.id
    ? await client.loanApplication.findUnique({ where: { id: ref.id } })
    : await client.loanApplication.findFirst({ where: { sessionId: ref.sessionId! } });
  if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Loan application not found" });
  return app;
}

/**
 * Convert a SIGNED application into a Customer (reuse-or-create) + Loan, link
 * them onto the application, and set status CONVERTED. Atomic.
 */
export function createConvertApplication(client: DbClient) {
  return async (
    input: ConvertApplicationInput,
    // Kept for signature parity with the other review actions; not yet recorded.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _reviewerId: string
  ): Promise<ConvertApplicationResult> => {
    const app = await loadByRef(client, input);

    const to = resolveReviewTransition("convert", app.status);
    if (!to) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Cannot convert an application in status ${app.status} (must be SIGNED).`
      });
    }
    if (app.customerId || app.loanId) {
      throw new TRPCError({ code: "CONFLICT", message: "Application is already converted." });
    }

    // Validate applicant data required to create a Customer.
    const name = [app.firstName, app.lastName].filter(Boolean).join(" ").trim();
    if (!name) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Application is missing the applicant name."
      });
    }
    if (!app.phone) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Application is missing the phone number."
      });
    }
    if (!app.idNumber || !CEDULA_RE.test(app.idNumber)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Application idNumber is missing or not in cédula format 000-0000000-0; fix it before converting."
      });
    }
    if (!app.homeAddress) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Application is missing the home address."
      });
    }

    return client.$transaction(async (tx) => {
      // Reuse an existing customer by cédula, then phone; else create one.
      let customer = await tx.customer.findFirst({ where: { idNumber: app.idNumber! } });
      if (!customer && app.phone) {
        customer = await tx.customer.findFirst({ where: { phone: app.phone } });
      }
      const reusedCustomer = Boolean(customer);
      if (!customer) {
        customer = await createCreateCustomer(tx)({
          name,
          phone: app.phone!,
          idNumber: app.idNumber!,
          homeAddress: app.homeAddress!,
          isBusinessOwner: true,
          assignedCollectorId: input.assignedCollectorId,
          isActive: true,
          preferredPaymentDay: null
        });
      }
      // A reused customer already carries a required assignedCollectorId
      // (mikro/#41: collector assignment is mandatory at every level), so no
      // backfill branch is needed here.

      const loan = await createCreateLoan(tx)({
        customerId: customer.id,
        principal: input.principal,
        termLength: input.termLength,
        paymentAmount: input.paymentAmount,
        paymentFrequency: input.paymentFrequency,
        startingDate: input.startingDate,
        moraRate: input.moraRate
      });

      const updated = await tx.loanApplication.update({
        where: { id: app.id },
        data: { status: to, customerId: customer.id, loanId: loan.loanId }
      });

      logger.verbose("loan application converted", {
        id: app.id,
        customerId: customer.id,
        loanId: loan.loanId,
        reusedCustomer
      });
      return { application: updated, customerId: customer.id, loanId: loan.loanId, reusedCustomer };
    });
  };
}
