/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import cliui from "cliui";
import moment from "moment";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

export default class ListByCollector extends BaseCommand<typeof ListByCollector> {
  static override readonly description =
    "display loans for members assigned to a specific collector";
  static override readonly examples = ["<%= config.bin %> <%= command.id %> <collector-id>"];
  static override readonly args = {
    ref: Args.string({
      description: "The Collector ID to filter by",
      required: true
    })
  };
  static override readonly flags = {
    "show-all": Flags.boolean({
      char: "a",
      description: "show all loans including completed, defaulted, and cancelled",
      default: false
    }),
    "page-size": Flags.string({
      char: "s",
      description: "the number of items to show",
      default: "100",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(ListByCollector);
    const client = this.createClient();

    try {
      const loans = await client.listLoansByCollector.query({
        assignedCollectorId: args.ref,
        showAll: flags["show-all"],
        limit: parseInt(flags["page-size"])
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
