/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { formatMoney } from "@mikro/common";
import { Args, Flags } from "@oclif/core";
import { BaseCommand, parseSingleDate } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import { promptLoanSelectIfMissing } from "../../lib/prompts.js";

export default class PreviewMora extends BaseCommand<typeof PreviewMora> {
  static override readonly description =
    "preview accrued mora (past-due fee) for a loan as of a given date";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> 10001",
    "<%= config.bin %> <%= command.id %> 10001 --date 2026-05-20"
  ];
  static override readonly args = {
    loanId: Args.string({
      description: "Loan ID (numeric, e.g., 10000, 10001)",
      required: false
    })
  };
  static override readonly flags = {
    date: Flags.string({
      description: "As-of date (YYYY-MM-DD) for mora calculation (default: today)",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(PreviewMora);
    const client = this.createClient();

    const loanId = await promptLoanSelectIfMissing(
      client,
      args.loanId,
      "Loan ID (numeric, e.g., 10000, 10001)",
      "loanId"
    );

    const asOf = flags.date ? parseSingleDate(flags.date) : undefined;

    try {
      const preview = await client.previewLateFee.query({
        loanId,
        ...(asOf ? { asOf } : {})
      });

      this.log("");
      this.log(`Cuota: ${formatMoney(preview.cuota)}`);
      this.log(`Mora bruta: ${formatMoney(preview.grossMora)}`);
      this.log(`Mora ya cobrada: ${formatMoney(preview.collectedMora)}`);
      this.log(
        `Mora neta (a cobrar): ${formatMoney(preview.accruedMora)} (${preview.daysLate} días)`
      );
      this.log(`Ciclos atrasados: ${preview.missedCycles}`);
      this.log(`Tasa de mora: ${(preview.moraRate * 100).toFixed(1)}%`);
      this.log(`Total sugerido (cuota + mora neta): ${formatMoney(preview.suggestedTotal)}`);
      this.log("");
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
