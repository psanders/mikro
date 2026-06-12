/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { GenerateModeloReportInput } from "@mikro/common";
import { runProjection } from "@mikro/common/projection";
import { renderModeloReportPdf, type ModeloReportData } from "@mikro/common/contracts";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { logger } from "../../logger.js";

// Brand assets ship next to the apiserver build; resolve relative to this file
// so paths hold both locally and in the container.
const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, "../../../assets/fonts");

function readOptional(path: string): Buffer | null {
  try {
    return existsSync(path) ? readFileSync(path) : null;
  } catch {
    return null;
  }
}

/** Load the four Inter TTF faces. Returns null if any face is missing. */
function loadFonts(): ModeloReportData["fonts"] {
  const regular = readOptional(join(FONTS_DIR, "Inter-Regular.ttf"));
  const medium = readOptional(join(FONTS_DIR, "Inter-Medium.ttf"));
  const semibold = readOptional(join(FONTS_DIR, "Inter-SemiBold.ttf"));
  const bold = readOptional(join(FONTS_DIR, "Inter-Bold.ttf"));
  if (!regular || !medium || !semibold || !bold) return null;
  return { regular, medium, semibold, bold };
}

export interface GeneratedModeloReport {
  dataBase64: string;
  filename: string;
  mimeType: "application/pdf";
}

/**
 * Render the Modelo de negocio projection as a branded PDF. Stateless: the
 * projection is computed server-side from the supplied parameters, so the PDF
 * matches what the page shows for the same inputs. No AI.
 */
export function createGenerateModeloReport() {
  return async (input: GenerateModeloReportInput): Promise<GeneratedModeloReport> => {
    const result = runProjection(input);

    const pdf = await renderModeloReportPdf({
      result,
      generatedAt: new Date(),
      fonts: loadFonts()
    });

    const date = new Date().toISOString().slice(0, 10);
    logger.verbose("generated modelo report", { bytes: pdf.length });

    return {
      dataBase64: pdf.toString("base64"),
      filename: `modelo-negocio-${date}.pdf`,
      mimeType: "application/pdf"
    };
  };
}
