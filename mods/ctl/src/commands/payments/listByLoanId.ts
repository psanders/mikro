/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { formatMoney } from "@mikro/common";
import { Args } from "@oclif/core";
import cliui from "cliui";
import moment from "moment";
import { ListCommand } from "../../ListCommand.js";
import errorHandler from "../../errorHandler.js";
import { cliuiCells, cliuiTableWidth, computeColumnWidths } from "../../lib/cliTableLayout.js";
import { promptLoanSelectIfMissing } from "../../lib/prompts.js";

export default class ListByLoanId extends ListCommand<typeof ListByLoanId> {
  static override readonly description = "display payments for a specific loan by numeric loan ID";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> 10000",
    "<%= config.bin %> <%= command.id %> 10001 -a"
  ];
  static override readonly args = {
    loanId: Args.string({
      description: "The numeric Loan ID to filter by (e.g., 10000, 10001)",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(ListByLoanId);
    const client = this.createClient();

    const loanId = await promptLoanSelectIfMissing(client, args.loanId, "Loan ID", "loanId", {
      showAll: flags["include-hidden"]
    });

    try {
      const payments = await client.listPaymentsByLoanId.query({
        loanId,
        showReversed: flags["include-hidden"],
        limit: flags["page-size"]
      });

      const headers = ["ID", "CUSTOMER NAME", "AMOUNT", "METHOD", "STATUS", "PAID AT"];
      const rows = payments.map((payment) => [
        payment.id,
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
