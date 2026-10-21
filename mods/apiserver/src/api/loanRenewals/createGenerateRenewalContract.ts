/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  ValidationError,
  generateRenewalContractSchema,
  getLoanRenewalSchema,
  type GenerateRenewalContractInput,
  type GetLoanRenewalInput,
  type RenewalActor
} from "@mikro/common";
import { TRPCError } from "@trpc/server";
import { readContract } from "../../applications/storage.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import {
  renderAndStoreCustomerContract,
  type GeneratedContract
} from "../customers/createGenerateCustomerContract.js";
import { decide, emitRenewalEvent, loadRenewal, viewOf, type LoanRenewalView } from "./support.js";

export interface RenewalContractResult {
  renewal: LoanRenewalView;
  contract: GeneratedContract;
}

export interface GenerateRenewalContractDeps {
  renderContract?: typeof renderAndStoreCustomerContract;
  now?: () => Date;
}

/**
 * Generate the new loan's contract from the renewal's STORED terms — never from
 * what is owed on the old loan, which only decides the ledger amount. The PDF is
 * stored content-addressed; its CustomerDocument row (linked to the renewal)
 * is written with the status change, and a previous generated contract's row
 * is replaced.
 */
export function createGenerateRenewalContract(
  client: PrismaClient,
  deps: GenerateRenewalContractDeps = {}
) {
  const renderContract = deps.renderContract ?? renderAndStoreCustomerContract;
  const now = deps.now ?? (() => new Date());

  return async (
    raw: GenerateRenewalContractInput,
    actor: RenewalActor
  ): Promise<RenewalContractResult> => {
    const parsed = generateRenewalContractSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(parsed.error);
    const input = parsed.data;

    const renewal = await loadRenewal(client, input.id);
    const to = decide(
      renewal,
      "generateContract",
      actor,
      {},
      {
        oldLoanActive: renewal.loan.status === "ACTIVE"
      }
    );

    const at = now();
    const contract = await renderContract(renewal.customer, {
      principal: Number(renewal.principal),
      installments: renewal.termLength,
      installmentAmount: Number(renewal.paymentAmount),
      frequency: renewal.paymentFrequency,
      startDate: renewal.startingDate ?? at,
      maritalStatus: input.maritalStatus,
      occupation: input.occupation
    });

    const updated = await client.$transaction(async (tx) => {
      const { count } = await tx.loanRenewal.updateMany({
        where: { id: renewal.id, status: renewal.status },
        data: { status: to, contractFilename: contract.saved.filename, contractGeneratedAt: at }
      });
      if (count === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "La renovación cambió mientras generabas el contrato; recarga e intenta de nuevo."
        });
      }
      if (renewal.contractFilename && renewal.contractFilename !== contract.saved.filename) {
        await tx.customerDocument.deleteMany({
          where: { renewalId: renewal.id, filename: renewal.contractFilename }
        });
      }
      const alreadyStored = await tx.customerDocument.findFirst({
        where: { renewalId: renewal.id, filename: contract.saved.filename },
        select: { id: true }
      });
      if (!alreadyStored) {
        await tx.customerDocument.create({
          data: {
            type: "CONTRACT",
            filename: contract.saved.filename,
            originalName: contract.filename,
            mimeType: "application/pdf",
            size: contract.saved.size,
            sha256: contract.saved.sha256,
            source: "DIRECT",
            customerId: renewal.customerId,
            renewalId: renewal.id,
            uploadedById: actor.id
          }
        });
      }
      const r = await loadRenewal(tx, renewal.id);
      await emitRenewalEvent(
        tx,
        "loan.renewal.contract_generated",
        actor,
        r,
        "generó el contrato de la renovación",
        {
          contractFilename: contract.filename
        }
      );
      return r;
    });

    return {
      renewal: viewOf(updated),
      contract: {
        dataBase64: contract.dataBase64,
        filename: contract.filename,
        mimeType: contract.mimeType
      }
    };
  };
}

/** The renewal's generated contract again (for "Descargar contrato"). */
export function createGetRenewalContract(client: PrismaClient) {
  return async (raw: GetLoanRenewalInput): Promise<GeneratedContract> => {
    const parsed = getLoanRenewalSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(parsed.error);
    const renewal = await loadRenewal(client, parsed.data.id);
    if (!renewal.contractFilename) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Esta renovación aún no tiene contrato." });
    }
    const { dataBase64 } = readContract(renewal.contractFilename);
    return {
      dataBase64,
      filename: `contrato-${renewal.customerId.slice(0, 8)}.pdf`,
      mimeType: "application/pdf"
    };
  };
}
