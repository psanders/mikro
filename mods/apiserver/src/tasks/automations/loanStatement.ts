/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * loan-statement: on-demand, read-only generation of a customer's loan
 * statement (JSON + branded 2-page PDF) via the shared `loanStatementReport`
 * definition (`@mikro/common`). Unlike `pay-collector`/`record-expense`/
 * `daily-close`, this automation never mutates the ledger — it produces a
 * document, nothing else. The loan-id `ask` slot is validated through the
 * exact same field the tRPC procedure and CLI command validate
 * (`generateLoanStatementSchema.shape.loanId`, coerced for text-input forms),
 * so an invalid/unknown loan id is rejected before generation runs — no
 * document, no ledger touch.
 */
import { z } from "zod/v4";
import { generateLoanStatementSchema, type DbClient } from "@mikro/common";
import type { Automation } from "../types.js";
import { createGenerateLoanStatement } from "../../api/reports/createGenerateLoanStatement.js";

export const loanStatement: Automation = {
  id: "loan-statement",
  title: "Estado de cuenta del préstamo",
  gateFloor: "confirm",
  params: {
    loanId: {
      label: "Préstamo (ID)",
      source: "ask",
      kind: "text",
      // Coerce the form's text input, then validate through the same schema
      // field the tRPC procedure and CLI command use — one contract, three surfaces.
      schema: z.coerce.number().pipe(generateLoanStatementSchema.shape.loanId)
    }
  },
  async execute(payload, deps) {
    const loanId = payload.loanId as number;
    const generate = createGenerateLoanStatement(deps.db as unknown as DbClient);
    // Read-only: generates the statement, never posts a transaction or
    // touches the loan/payment ledger.
    const result = await generate({ loanId, format: "pdf" });

    return {
      summary: `Estado de cuenta del préstamo #${loanId} generado (${result.data.schedule.length} cuotas, ${result.data.evalReport.passCount}/${result.data.evalReport.results.length} controles superados).`,
      // Carried back to the confirm caller only — never persisted onto the
      // task.completed event (no storage, per design).
      attachment: {
        filename: result.filename,
        mimeType: result.mimeType,
        base64: result.pdfBase64!
      }
    };
  }
};
