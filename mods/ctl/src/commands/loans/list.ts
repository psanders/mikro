/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import cliui from "cliui";
import moment from "moment";
import { ListCommand } from "../../ListCommand.js";
import errorHandler from "../../errorHandler.js";
import { cliuiCells, cliuiTableWidth, computeColumnWidths } from "../../lib/cliTableLayout.js";

export default class List extends ListCommand<typeof List> {
  static override readonly description = "display all loans";
  static override readonly examples = ["<%= config.bin %> <%= command.id %>"];
  static override readonly flags = {
    "include-closed": Flags.boolean({
      char: "a",
      description: "include closed loans (completed, defaulted, and cancelled)",
      default: false
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(List);
    const client = this.createClient();

    try {
      const loans = await client.listLoans.query({
        showAll: flags["include-closed"],
        limit: flags["page-size"]
      });

      const headers = [
        "LOAN #",
        "PRINCIPAL",
        "PAYMENT",
        "FREQ",
        "STATUS",
        "CREATED",
        "CUSTOMER NAME",
        "NICKNAME"
      ];
      const rows = loans.map((loan) => [
        String(loan.loanId),
        String(loan.principal),
        String(loan.paymentAmount),
        loan.paymentFrequency,
        loan.status,
        moment(loan.createdAt).format("YYYY-MM-DD"),
        loan.customer.name,
        (loan as { nickname?: string | null }).nickname ?? ""
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
