/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { formatMoney } from "@mikro/common";
import { Args, Flags } from "@oclif/core";
import cliui from "cliui";
import moment from "moment";
import { ListCommand } from "../../ListCommand.js";
import { validateDate } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import { cliuiCells, cliuiTableWidth, computeColumnWidths } from "../../lib/cliTableLayout.js";
import { promptUserSelectIfMissing } from "../../lib/prompts.js";

export default class ListByReferrer extends ListCommand<typeof ListByReferrer> {
  static override readonly description =
    "display payments for customers referred by a specific user";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <referrerId> --start-date 2026-01-01 --end-date 2026-01-31"
  ];
  static override readonly args = {
    referrerId: Args.string({
      description: "The Referrer ID to filter by",
      required: false
    })
  };
  static override readonly flags = {
    "start-date": Flags.string({
      description: "start date (YYYY-MM-DD)",
      required: true
    }),
    "end-date": Flags.string({
      description: "end date (YYYY-MM-DD)",
      required: true
    }),
    "include-reversed": Flags.boolean({
      char: "a",
      description: "include reversed payments",
      default: false
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(ListByReferrer);
    const client = this.createClient();

    const referrerId = await promptUserSelectIfMissing(
      client,
      args.referrerId,
      "Referrer",
      "referrerId",
      { role: "REFERRER" }
    );

    // Validate date formats
    validateDate(flags["start-date"]!);
    validateDate(flags["end-date"]!);

    try {
      const payments = await client.listPaymentsByReferrer.query({
        referredById: referrerId,
        startDate: new Date(flags["start-date"]!),
        endDate: new Date(flags["end-date"]!),
        showReversed: flags["include-reversed"],
        limit: flags["page-size"]
      });

      const headers = ["ID", "LOAN #", "CUSTOMER NAME", "AMOUNT", "METHOD", "STATUS", "PAID AT"];
      const rows = payments.map((payment) => [
        payment.id,
        String(payment.loan.loanId),
        payment.loan.customer.name,
        formatMoney(payment.amount),
        payment.method,
        payment.status,
        moment(payment.paidAt).format("YYYY-MM-DD HH:mm")
      ]);
      const widths = computeColumnWidths({ headers, rows });
      const ui = cliui({ width: cliuiTableWidth(widths) });
      ui.div(...cliuiCells(headers, widths));
      for (const row of rows) {
        ui.div(...cliuiCells(row, widths));
      }

      this.log(ui.toString());
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
