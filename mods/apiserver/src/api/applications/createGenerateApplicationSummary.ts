/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type {
  ApplicationScore,
  DbClient,
  GenerateApplicationSummaryInput
} from "@mikro/common";
import { renderSummaryPdf, type SolicitudSummaryData } from "@mikro/common/contracts";
import { TRPCError } from "@trpc/server";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { logger } from "../../logger.js";

// Brand assets ship next to the apiserver build; resolve relative to this file
// so paths hold both locally and in the container (assetsPath config points at
// the container path only).
const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(__dirname, "../../../assets");
const FONTS_DIR = join(ASSETS_DIR, "fonts");

/** Read a file if it exists, else null (never throws). */
function readOptional(path: string): Buffer | null {
  try {
    return existsSync(path) ? readFileSync(path) : null;
  } catch {
    return null;
  }
}

/** Load the four Inter TTF faces. Returns null if any face is missing. */
function loadFonts(): SolicitudSummaryData["fonts"] {
  const regular = readOptional(join(FONTS_DIR, "Inter-Regular.ttf"));
  const medium = readOptional(join(FONTS_DIR, "Inter-Medium.ttf"));
  const semibold = readOptional(join(FONTS_DIR, "Inter-SemiBold.ttf"));
  const bold = readOptional(join(FONTS_DIR, "Inter-Bold.ttf"));
  if (!regular || !medium || !semibold || !bold) return null;
  return { regular, medium, semibold, bold };
}

export interface GeneratedSummary {
  dataBase64: string;
  filename: string;
  mimeType: "application/pdf";
}

/** Render a printable solicitud summary PDF. Stateless — no side effects. */
export function createGenerateApplicationSummary(client: DbClient) {
  return async (input: GenerateApplicationSummaryInput): Promise<GeneratedSummary> => {
    const app = input.id
      ? await client.loanApplication.findUnique({ where: { id: input.id } })
      : await client.loanApplication.findFirst({ where: { sessionId: input.sessionId! } });
    if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Loan application not found" });

    const raw = (app.rawData ?? {}) as Record<string, unknown>;
    const str = (key: string): string | null => {
      const v = raw[key];
      return typeof v === "string" && v.trim() ? v.trim() : null;
    };

    const scoreData = (app.scoreData as ApplicationScore | null) ?? null;

    const data: SolicitudSummaryData = {
      id: app.id,
      createdAt: app.createdAt,
      status: app.status,
      firstName: app.firstName,
      lastName: app.lastName,
      phone: app.phone,
      idNumber: app.idNumber,
      dateOfBirth: app.dateOfBirth,
      maritalStatus: app.maritalStatus,
      businessType: app.businessType,
      businessName: app.businessName,
      businessAge: str("businessAge"),
      monthlySales: str("monthlySales"),
      locationType: str("locationType"),
      formalization: str("formalization"),
      employeeCount: str("employeeCount"),
      businessPhone: str("businessPhone"),
      requestedAmount: app.requestedAmount ? Number(app.requestedAmount) : null,
      purpose: app.purpose,
      requestedTermWeeks: app.requestedTermWeeks,
      spouseName: str("spouseName"),
      spousePhone: str("spousePhone"),
      referenceName: str("referenceName"),
      referencePhone: str("referencePhone"),
      housingType: str("housingType"),
      residenceTime: str("residenceTime"),
      homeAddress: app.homeAddress,
      province: app.province,
      addressReference: str("addressReference"),
      score: app.score,
      riskBand: app.riskBand,
      recommendation: scoreData?.recommendation ?? null,
      confidence: scoreData?.confidence ?? null,
      scoreCategories: scoreData?.categories ?? null,
      scoreIndicators: scoreData?.indicators ?? null,
      evaluatorNotes: scoreData?.evaluator_notes ?? null,
      flags: scoreData?.flags ?? null,
      fonts: loadFonts()
    };

    const pdf = await renderSummaryPdf(data);
    logger.verbose("generated application summary", { id: app.id, bytes: pdf.length });

    return {
      dataBase64: pdf.toString("base64"),
      filename: `solicitud-${app.id.slice(0, 8)}.pdf`,
      mimeType: "application/pdf"
    };
  };
}
