/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";
import {
  withErrorHandlingAndValidation,
  exportAuditLogSchema,
  amountToNumber
} from "@mikro/common";
import type { EventClient } from "./recordEvent.js";

type ExportAuditLogInput = z.infer<typeof exportAuditLogSchema>;

export interface ExportAuditLogResult {
  filename: string;
  csv: string;
}

const HEADERS = [
  "occurredAt",
  "type",
  "actorName",
  "customerName",
  "loanId",
  "applicationId",
  "amount",
  "summary"
] as const;

/** RFC-4180 field quoting: wrap in double quotes and double any inner quote when the value contains a comma, quote, CR, or LF. */
function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Month-scoped CSV export of the event log, generated directly from
 * business_events. Produces a valid CSV with a header row always present — an
 * empty month yields headers only.
 */
export function createExportAuditLog(client: EventClient) {
  const fn = async (input: ExportAuditLogInput): Promise<ExportAuditLogResult> => {
    const start = new Date(Date.UTC(input.year, input.month - 1, 1));
    const end = new Date(Date.UTC(input.year, input.month, 1));

    const rows = await client.businessEvent.findMany({
      where: { occurredAt: { gte: start, lt: end } },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }]
    });

    const lines: string[] = [HEADERS.join(",")];
    for (const row of rows) {
      const fields = [
        new Date(row.occurredAt).toISOString(),
        row.type,
        row.actorName,
        row.customerName ?? "",
        row.loanId ?? "",
        row.applicationId ?? "",
        row.amount == null ? "" : String(amountToNumber(row.amount)),
        row.summary
      ];
      lines.push(fields.map((f) => csvField(f)).join(","));
    }

    const mm = String(input.month).padStart(2, "0");
    return {
      filename: `registro-auditoria-${input.year}-${mm}.csv`,
      // Trailing CRLF-friendly newline join per RFC-4180 (records separated by CRLF).
      csv: lines.join("\r\n")
    };
  };

  return withErrorHandlingAndValidation(fn, exportAuditLogSchema);
}
