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
    "show-all": Flags.boolean({
      char: "a",
      description: "show all loans including completed, defaulted, and cancelled",
      default: false,
    }),
    "page-size": Flags.string({
      char: "s",
      description: "the number of items to show",
      default: "100",
      required: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(List);
    const client = this.createClient();

    try {
      const loans = await client.listLoans.query({
        showAll: flags["show-all"],
        limit: parseInt(flags["page-size"]),
      });

      const ui = cliui({ width: 180 });

      ui.div(
        { text: "ID", padding: [0, 0, 0, 0], width: 40 },
        { text: "LOAN #", padding: [0, 0, 0, 0], width: 10 },
        { text: "PRINCIPAL", padding: [0, 0, 0, 0], width: 12 },
        { text: "PAYMENT", padding: [0, 0, 0, 0], width: 10 },
        { text: "FREQ", padding: [0, 0, 0, 0], width: 8 },
        { text: "STATUS", padding: [0, 0, 0, 0], width: 12 },
        { text: "CREATED", padding: [0, 0, 0, 0], width: 12 },
        { text: "MEMBER ID", padding: [0, 0, 0, 0], width: 40 }
      );

      loans.forEach((loan) => {
        ui.div(
          { text: loan.id, padding: [0, 0, 0, 0], width: 40 },
          { text: String(loan.loanId), padding: [0, 0, 0, 0], width: 10 },
          { text: String(loan.principal), padding: [0, 0, 0, 0], width: 12 },
          { text: String(loan.paymentAmount), padding: [0, 0, 0, 0], width: 10 },
          { text: loan.paymentFrequency, padding: [0, 0, 0, 0], width: 8 },
          { text: loan.status, padding: [0, 0, 0, 0], width: 12 },
          { text: moment(loan.createdAt).format("YYYY-MM-DD"), padding: [0, 0, 0, 0], width: 12 },
          { text: loan.memberId, padding: [0, 0, 0, 0], width: 40 }
        );
      });

      this.log(ui.toString());
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
