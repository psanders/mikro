/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import cliui from "cliui";
import moment from "moment";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

export default class List extends BaseCommand<typeof List> {
  static override readonly description = "display all loans";
  static override readonly examples = ["<%= config.bin %> <%= command.id %>"];
  static override readonly flags = {
    "include-closed": Flags.boolean({
      char: "a",
      description: "include closed loans (completed, defaulted, and cancelled)",
      default: false
    }),
    "page-size": Flags.integer({
      char: "s",
      description: "the number of items to show",
      default: 100
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

      const ui = cliui({ width: 140 });

      ui.div(
        { text: "LOAN #", padding: [0, 0, 0, 0], width: 10 },
        { text: "PRINCIPAL", padding: [0, 0, 0, 0], width: 12 },
        { text: "PAYMENT", padding: [0, 0, 0, 0], width: 10 },
        { text: "FREQ", padding: [0, 0, 0, 0], width: 8 },
        { text: "STATUS", padding: [0, 0, 0, 0], width: 12 },
        { text: "CREATED", padding: [0, 0, 0, 0], width: 12 },
        { text: "MEMBER NAME", padding: [0, 0, 0, 0], width: 35 }
      );

      loans.forEach((loan) => {
        ui.div(
          { text: String(loan.loanId), padding: [0, 0, 0, 0], width: 10 },
          { text: String(loan.principal), padding: [0, 0, 0, 0], width: 12 },
          { text: String(loan.paymentAmount), padding: [0, 0, 0, 0], width: 10 },
          { text: loan.paymentFrequency, padding: [0, 0, 0, 0], width: 8 },
          { text: loan.status, padding: [0, 0, 0, 0], width: 12 },
          { text: moment(loan.createdAt).format("YYYY-MM-DD"), padding: [0, 0, 0, 0], width: 12 },
          { text: loan.member.name, padding: [0, 0, 0, 0], width: 35 }
        );
      });

      this.log(ui.toString());
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
