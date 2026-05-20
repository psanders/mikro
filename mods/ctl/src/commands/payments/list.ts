/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { formatMoney } from "@mikro/common";
import { Flags } from "@oclif/core";
import cliui from "cliui";
import moment from "moment";
import { ListCommand } from "../../ListCommand.js";
import { parseDateRange } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import { cliuiCells, cliuiTableWidth, computeColumnWidths } from "../../lib/cliTableLayout.js";

export default class List extends ListCommand<typeof List> {
  static override readonly description = "display all payments within a date range";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --start-date 2026-01-01 --end-date 2026-01-31",
    "<%= config.bin %> <%= command.id %> --start-date 2026-01-01 --end-date 2026-04-30 -s 100 --offset 100"
  ];
  static override readonly flags = {
    "start-date": Flags.string({
      description: "start date (YYYY-MM-DD); default: 30 days ago"
    }),
    "end-date": Flags.string({
      description: "end date (YYYY-MM-DD); default: today"
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(List);
    const client = this.createClient();

    const { startDate, endDate } = parseDateRange(flags["start-date"], flags["end-date"], {
      defaultDays: 30
    });

    try {
      const payments = await client.listPayments.query({
        startDate,
        endDate,
        showReversed: flags["include-hidden"],
        limit: flags["page-size"],
        offset: flags.offset
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
      const n = payments.length;
      const cap = flags["page-size"];
      this.log(`\n${n} payment(s) shown (page size ${cap}, offset ${flags.offset}).`);
      if (n === cap) {
        this.log(
          "If this equals the page size, more payments may exist in this date range. " +
            "The API returns at most 100 rows per request — run again with e.g. `--offset 100` (then 200, …) " +
            "or narrow `--start-date` / `--end-date`."
        );
      }
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
