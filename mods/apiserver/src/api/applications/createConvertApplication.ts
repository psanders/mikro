/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { resolveReviewTransition, getConfig } from "@mikro/common";
import type {
  DbClient,
  LoanApplication,
  ConvertApplicationInput,
  CustomerDocumentType
} from "@mikro/common";
import { TRPCError } from "@trpc/server";
import { createCreateCustomer } from "../customers/createCreateCustomer.js";
import { createCreateLoan } from "../loans/createCreateLoan.js";
import { postTransactionCore } from "../accounting/postTransaction.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { logger } from "../../logger.js";

const CEDULA_RE = /^\d{3}-\d{7}-\d{1}$/;

/**
 * Application document files are stored on disk as `<sha256>.<ext>`
 * (see applications/storage.ts); ID front/back rows don't carry a separate
 * sha256 column, so it's derived from the filename rather than duplicating it.
 */
function sha256FromFilename(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? filename : filename.slice(0, dot);
}

interface ApplicationDocumentField {
  type: CustomerDocumentType;
  filename: string | null;
  originalName: string | null;
  mimeType: string | null;
  size: number | null;
}

/**
 * The application's stored documents (signed contract, ID front/back),
 * filtered to only those actually present. Copied by reference (same
 * filename/sha256, no file I/O) into CustomerDocument rows on conversion —
 * see the migration step in createConvertApplication below.
 */
function applicationDocuments(app: LoanApplication): ApplicationDocumentField[] {
  const fields: ApplicationDocumentField[] = [
    {
      type: "CONTRACT",
      filename: app.contractFilename,
      originalName: app.contractOriginalName,
      mimeType: app.contractMimeType,
      size: app.contractSize
    },
    {
      type: "ID_FRONT",
      filename: app.idFrontFilename,
      originalName: app.idFrontOriginalName,
      mimeType: app.idFrontMimeType,
      size: app.idFrontSize
    },
    {
      type: "ID_BACK",
      filename: app.idBackFilename,
      originalName: app.idBackOriginalName,
      mimeType: app.idBackMimeType,
      size: app.idBackSize
    }
  ];
  return fields.filter((f) => f.filename != null);
}

export interface ConvertApplicationResult {
  application: LoanApplication;
  customerId: string;
  loanId: number;
  reusedCustomer: boolean;
  /** The disbursement transaction auto-posted to the ledger (mikro/#155). */
  disbursement: {
    transactionId: string;
    accountId: string;
    accountName: string;
    amount: number;
  };
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
    reviewerId: string
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

    // mikro/#155: every conversion auto-deducts the disbursed principal from
    // the ledger. `accounting.disbursementAccountId` is a required config
    // field (mikro.json) — the apiserver refuses to boot without it, so
    // there's nothing to validate here.
    const disbursementAccountId = getConfig().accounting.disbursementAccountId;

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

      // Copy the application's stored documents (signed contract, ID
      // front/back) onto the new customer, by reference — same filename/
      // sha256, no file I/O, no change to the application's own document
      // columns (they remain the immutable review-time audit record).
      const documentsToMigrate = applicationDocuments(app);
      if (documentsToMigrate.length > 0) {
        await tx.customerDocument.createMany({
          data: documentsToMigrate.map((doc) => ({
            type: doc.type,
            filename: doc.filename!,
            originalName: doc.originalName,
            mimeType: doc.mimeType,
            size: doc.size,
            sha256: sha256FromFilename(doc.filename!),
            source: "MIGRATED_FROM_APPLICATION" as const,
            customerId: customer.id
          }))
        });
      }

      // Auto-deduct the disbursed principal from the ledger in the SAME
      // transaction as the loan creation (mikro/#155): either both commit or
      // neither does. WITHDRAWAL, not EXPENSE — disbursed principal is a
      // capital movement (cash → loan receivable), not an operating expense,
      // mirroring the DEPOSIT-not-INCOME treatment of loan repayments.
      const disbursement = await postTransactionCore(tx as unknown as PrismaClient, {
        type: "WITHDRAWAL",
        accountId: disbursementAccountId,
        amount: input.principal,
        occurredAt: new Date(),
        description: `Desembolso de préstamo #${loan.loanId} para ${name}`,
        reference: `loan-disbursement:${loan.loanId}`,
        createdById: reviewerId
      });

      const updated = await tx.loanApplication.update({
        where: { id: app.id },
        data: { status: to, customerId: customer.id, loanId: loan.loanId }
      });

      logger.verbose("loan application converted", {
        id: app.id,
        customerId: customer.id,
        loanId: loan.loanId,
        reusedCustomer,
        disbursementTransactionId: disbursement.id,
        migratedDocuments: documentsToMigrate.length
      });
      return {
        application: updated,
        customerId: customer.id,
        loanId: loan.loanId,
        reusedCustomer,
        disbursement: {
          transactionId: disbursement.id,
          accountId: disbursement.account.id,
          accountName: disbursement.account.name,
          amount: input.principal
        }
      };
    });
  };
}
