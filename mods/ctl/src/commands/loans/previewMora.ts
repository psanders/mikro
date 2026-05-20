/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { formatMoney } from "@mikro/common";
import { Flags } from "@oclif/core";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import { promptNumberIfMissing } from "../../lib/prompts.js";

export default class PreviewMora extends BaseCommand<typeof PreviewMora> {
  static override readonly description =
    "preview accrued mora (past-due fee) for a loan as of a given date";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --loan-id 10001",
    "<%= config.bin %> <%= command.id %> --loan-id 10001 --as-of 2026-05-20"
  ];
  static override readonly flags = {
    "loan-id": Flags.integer({
      description: "Loan ID (numeric, e.g., 10000, 10001)",
      required: false
    }),
    "as-of": Flags.string({
      description: "As-of date (YYYY-MM-DD) for mora calculation",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(PreviewMora);
    const client = this.createClient();

    const loanId = await promptNumberIfMissing(
      flags["loan-id"],
      "Loan ID (numeric, e.g., 10000, 10001)",
      "loan-id"
    );

    const asOfStr = flags["as-of"];
    let asOf: Date | undefined;
    if (asOfStr) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asOfStr.trim());
      if (!m) {
        this.error("Invalid --as-of date. Use YYYY-MM-DD.");
        return;
      }
      asOf = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
    }

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
