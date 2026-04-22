/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import cliui from "cliui";
import moment from "moment";
import { ListCommand } from "../../ListCommand.js";
import errorHandler from "../../errorHandler.js";
import { cliuiCells, cliuiTableWidth, computeColumnWidths } from "../../lib/cliTableLayout.js";
import { promptUserSelectIfMissing } from "../../lib/prompts.js";

export default class ListByReferrer extends ListCommand<typeof ListByReferrer> {
  static override readonly description = "display loans for customers referred by a specific user";
  static override readonly examples = ["<%= config.bin %> <%= command.id %> <referrerId>"];
  static override readonly args = {
    referrerId: Args.string({
      description: "The Referrer ID to filter by",
      required: false
    })
  };
  static override readonly flags = {
    "include-closed": Flags.boolean({
      char: "a",
      description: "include closed loans (completed, defaulted, and cancelled)",
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

    try {
      const loans = await client.listLoansByReferrer.query({
        referredById: referrerId,
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
