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

export default class ListByCustomer extends ListCommand<typeof ListByCustomer> {
  static override readonly description = "display payments for a specific customer";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <customerId> --start-date 2026-01-01 --end-date 2026-01-31"
  ];
  static override readonly args = {
    customerId: Args.string({
      description: "The Customer ID to filter by",
      required: true
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
    const { args, flags } = await this.parse(ListByCustomer);
    const client = this.createClient();

    // Validate date formats
    validateDate(flags["start-date"]!);
    validateDate(flags["end-date"]!);

    try {
      const payments = await client.listPaymentsByCustomer.query({
        customerId: args.customerId,
        startDate: new Date(flags["start-date"]!),
        endDate: new Date(flags["end-date"]!),
        showReversed: flags["include-reversed"],
        limit: flags["page-size"]
      });

      const headers = ["ID", "LOAN #", "AMOUNT", "METHOD", "STATUS", "PAID AT"];
      const rows = payments.map((payment) => [
        payment.id,
        String(payment.loan.loanId),
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
