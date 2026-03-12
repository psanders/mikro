/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import { resolve } from "path";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import {
  outputCollectionsAuditAsTable,
  handleCollectionsAuditOutput
} from "../../lib/exportUtils.js";

export default class ReportsCollectionsAudit extends BaseCommand<typeof ReportsCollectionsAudit> {
  static override readonly description =
    "daily collections audit: who was notified, message type, status, errors (default: today)";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --date 2026-03-12",
    "<%= config.bin %> <%= command.id %> --output auditoria.csv",
    "<%= config.bin %> <%= command.id %> --date 2026-03-12 --output auditoria.xlsx"
  ];

  static override readonly flags = {
    date: Flags.string({
      description: "Audit date (YYYY-MM-DD). Default: today",
      char: "d"
    }),
    output: Flags.string({
      description: "Write to file. Extension: .csv or .xlsx",
      char: "o"
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ReportsCollectionsAudit);

    try {
      const client = this.createClient();
      const input: { date?: string } = {};
      if (flags.date) input.date = flags.date;

      this.log("Generating collections audit report...");
      const result = await client.generateCollectionsAuditReport.mutate(input);
      const { rows } = result;

      const wrote = await handleCollectionsAuditOutput(
        rows,
        flags.output ? resolve(flags.output) : undefined,
        this.log.bind(this),
        this.error.bind(this) as (msg: string) => never
      );
      if (!wrote) {
        outputCollectionsAuditAsTable(rows, this.log.bind(this));
      }
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
