/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import cliui from "cliui";
import moment from "moment";
import { ListCommand } from "../../ListCommand.js";
import { validateDate } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import { cliuiCells, cliuiTableWidth, computeColumnWidths } from "../../lib/cliTableLayout.js";

export default class List extends ListCommand<typeof List> {
  static override readonly description = "display all payments within a date range";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> --start-date 2026-01-01 --end-date 2026-01-31"
  ];
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
    const { flags } = await this.parse(List);
    const client = this.createClient();

    // Validate date formats
    validateDate(flags["start-date"]!);
    validateDate(flags["end-date"]!);

    try {
      const payments = await client.listPayments.query({
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
        String(payment.amount),
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
