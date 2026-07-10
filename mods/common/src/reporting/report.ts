/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The shared Report contract. A report is defined ONCE as a typed data model
 * and projected to both a JSON payload and a branded PDF, so every entry point
 * (CLI, dashboard, copilot) consumes one definition with no per-format
 * duplication. `toJson` returns the full typed data model (canonical); `toPdf`
 * composes reusable layout blocks into pages and renders them — presentation
 * only, never additional data.
 */
import type { z } from "zod/v4";
import { withErrorHandlingAndValidation } from "../utils/withErrorHandlingAndValidation.js";
import { renderReportToPdf, type ReportDocument, type RenderReportDeps } from "./renderer.js";

/**
 * A report definition. Supply the typed input schema, a `buildData` projection
 * that produces the canonical data model, and a `toDocument` layout that turns
 * that data model into renderable pages.
 */
export interface ReportSpec<TSchema extends z.ZodType, TData> {
  /** Stable report name (used by callers/logs). */
  name: string;
  /** Zod schema for the report input. Validated before anything runs. */
  inputSchema: TSchema;
  /** Build the canonical, fully-typed data model from validated input. */
  buildData: (input: z.infer<TSchema>) => TData | Promise<TData>;
  /** Compose the PDF pages from the data model (presentation only). */
  toDocument: (data: TData) => ReportDocument;
}

/**
 * A ready-to-use report: request `json`, `pdf`, or both from the same
 * definition for a given input and receive equivalent content. Invalid input
 * throws a structured `ValidationError` before any output is produced.
 */
export interface Report<TData> {
  name: string;
  /** Canonical typed data model (the full data the PDF is drawn from). */
  toJson(input: unknown): Promise<TData>;
  /** Branded multi-page PDF Buffer built from the same data model. */
  toPdf(input: unknown, deps?: RenderReportDeps): Promise<Buffer>;
}

/**
 * Define a report from a spec. The returned `toJson`/`toPdf` both validate the
 * input against `inputSchema` first (throwing `ValidationError` on failure with
 * no side effect) and then project the SAME `buildData` result — JSON is the
 * canonical data model, PDF adds only presentation.
 */
export function defineReport<TSchema extends z.ZodType, TData>(
  spec: ReportSpec<TSchema, TData>
): Report<TData> {
  const buildValidated = withErrorHandlingAndValidation(
    async (input: z.infer<TSchema>) => spec.buildData(input),
    spec.inputSchema
  );

  return {
    name: spec.name,
    async toJson(input: unknown): Promise<TData> {
      return buildValidated(input);
    },
    async toPdf(input: unknown, deps?: RenderReportDeps): Promise<Buffer> {
      const data = await buildValidated(input);
      const doc = spec.toDocument(data);
      return renderReportToPdf(doc, deps);
    }
  };
}
