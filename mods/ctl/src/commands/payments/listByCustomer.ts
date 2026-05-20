/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { formatMoney } from "@mikro/common";
import { Args, Flags } from "@oclif/core";
import cliui from "cliui";
import moment from "moment";
import { ListCommand } from "../../ListCommand.js";
import { parseDateRange } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import { cliuiCells, cliuiTableWidth, computeColumnWidths } from "../../lib/cliTableLayout.js";
import { promptCustomerSelectIfMissing } from "../../lib/prompts.js";

export default class ListByCustomer extends ListCommand<typeof ListByCustomer> {
  static override readonly description = "display payments for a specific customer";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <customerId>",
    "<%= config.bin %> <%= command.id %> <customerId> --start-date 2026-01-01 --end-date 2026-01-31"
  ];
  static override readonly args = {
    customerId: Args.string({
      description: "The Customer ID to filter by",
      required: false
    })
  };
  static override readonly flags = {
    "start-date": Flags.string({
      description: "start date (YYYY-MM-DD); default: 30 days ago"
    }),
    "end-date": Flags.string({
      description: "end date (YYYY-MM-DD); default: today"
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(ListByCustomer);
    const client = this.createClient();

    const customerId = await promptCustomerSelectIfMissing(
      client,
      args.customerId,
      "Customer",
      "customerId"
    );

    const { startDate, endDate } = parseDateRange(flags["start-date"], flags["end-date"], {
      defaultDays: 30
    });

    try {
      const payments = await client.listPaymentsByCustomer.query({
        customerId,
        startDate,
        endDate,
        showReversed: flags["include-hidden"],
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
