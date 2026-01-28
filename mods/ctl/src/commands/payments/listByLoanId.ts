/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import cliui from "cliui";
import moment from "moment";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

export default class ListByLoanId extends BaseCommand<typeof ListByLoanId> {
  static override readonly description = "display payments for a specific loan by numeric loan ID";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> 10000",
    "<%= config.bin %> <%= command.id %> 10001 --include-reversed"
  ];
  static override readonly args = {
    loanId: Args.string({
      description: "The numeric Loan ID to filter by (e.g., 10000, 10001)",
      required: true
    })
  };
  static override readonly flags = {
    "include-reversed": Flags.boolean({
      char: "a",
      description: "include reversed payments",
      default: false
    }),
    "page-size": Flags.integer({
      char: "s",
      description: "the number of items to show",
      default: 100
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(ListByLoanId);
    const client = this.createClient();

    try {
      const payments = await client.listPaymentsByLoanId.query({
        loanId: parseInt(args.loanId),
        showReversed: flags["include-reversed"],
        limit: flags["page-size"]
      });

      const ui = cliui({ width: 170 });

      ui.div(
        { text: "ID", padding: [0, 0, 0, 0], width: 38 },
        { text: "MEMBER NAME", padding: [0, 0, 0, 0], width: 30 },
        { text: "AMOUNT", padding: [0, 0, 0, 0], width: 15 },
        { text: "METHOD", padding: [0, 0, 0, 0], width: 12 },
        { text: "STATUS", padding: [0, 0, 0, 0], width: 12 },
        { text: "PAID AT", padding: [0, 0, 0, 0], width: 20 }
      );

      payments.forEach((payment) => {
        ui.div(
          { text: payment.id, padding: [0, 0, 0, 0], width: 38 },
          { text: payment.loan.member.name, padding: [0, 0, 0, 0], width: 30 },
          { text: String(payment.amount), padding: [0, 0, 0, 0], width: 15 },
          { text: payment.method, padding: [0, 0, 0, 0], width: 12 },
          { text: payment.status, padding: [0, 0, 0, 0], width: 12 },
          {
            text: moment(payment.paidAt).format("YYYY-MM-DD HH:mm"),
            padding: [0, 0, 0, 0],
            width: 20
          }
        );
      });

      this.log(ui.toString());
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
