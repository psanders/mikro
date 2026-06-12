/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  BUSINESS_TYPE_LABELS,
  PROVINCE_LABELS,
  type DbClient,
  type GenerateApplicationContractInput
} from "@mikro/common";
import { renderContractPdf, type ContractData } from "@mikro/common/contracts";
import { TRPCError } from "@trpc/server";
import { logger } from "../../logger.js";

export interface GeneratedContract {
  dataBase64: string;
  filename: string;
  mimeType: "application/pdf";
}

/**
 * Render the loan contract PDF for an application. Applicant identity comes from
 * the application; the negotiated terms + debtor gender come from the reviewer
 * (post-approval "Generar contrato" step). Stateless — does not persist anything.
 */
export function createGenerateApplicationContract(client: DbClient) {
  return async (input: GenerateApplicationContractInput): Promise<GeneratedContract> => {
    const app = input.id
      ? await client.loanApplication.findUnique({ where: { id: input.id } })
      : await client.loanApplication.findFirst({ where: { sessionId: input.sessionId! } });
    if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Loan application not found" });

    const name = [app.firstName, app.lastName].filter(Boolean).join(" ").trim();
    if (!name || !app.idNumber) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "The application is missing the applicant name or cédula."
      });
    }

    const data: ContractData = {
      debtor: {
        name,
        cedula: app.idNumber,
        gender: input.gender,
        maritalStatus: input.maritalStatus ?? app.maritalStatus?.toLowerCase() ?? undefined,
        occupation:
          input.occupation ??
          (app.businessType
            ? (BUSINESS_TYPE_LABELS[app.businessType] ?? app.businessType)
            : undefined),
        city: app.province ? (PROVINCE_LABELS[app.province] ?? app.province) : "—"
      },
      principal: Number(app.requestedAmount) || 0,
      installments: input.installments,
      installmentAmount: input.installmentAmount,
      frequency: input.frequency,
      startDate: new Date(input.startDate),
      contractDate: new Date()
    };

    const pdf = await renderContractPdf(data);
    logger.verbose("generated application contract", { id: app.id, bytes: pdf.length });

    return {
      dataBase64: pdf.toString("base64"),
      filename: `contrato-${app.id.slice(0, 8)}.pdf`,
      mimeType: "application/pdf"
    };
  };
}
