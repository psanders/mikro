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
    "<%= config.bin %> <%= command.id %> 10001 --show-reversed"
  ];
  static override readonly args = {
    loanId: Args.string({
      description: "The numeric Loan ID to filter by (e.g., 10000, 10001)",
      required: true
    })
  };
  static override readonly flags = {
    "show-reversed": Flags.boolean({
      char: "a",
      description: "show all payments including reversed",
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
    const { args, flags } = await this.parse(ListByLoanId);
    const client = this.createClient();

    try {
      const payments = await client.listPaymentsByLoanId.query({
        loanId: parseInt(args.loanId),
        showReversed: flags["show-reversed"],
        limit: parseInt(flags["page-size"])
      });

      const ui = cliui({ width: 170 });

      ui.div(
        { text: "ID", padding: [0, 0, 0, 0], width: 40 },
        { text: "AMOUNT", padding: [0, 0, 0, 0], width: 15 },
        { text: "METHOD", padding: [0, 0, 0, 0], width: 12 },
        { text: "STATUS", padding: [0, 0, 0, 0], width: 12 },
        { text: "PAID AT", padding: [0, 0, 0, 0], width: 20 },
        { text: "LOAN ID", padding: [0, 0, 0, 0], width: 40 }
      );

      payments.forEach((payment) => {
        ui.div(
          { text: payment.id, padding: [0, 0, 0, 0], width: 40 },
          { text: String(payment.amount), padding: [0, 0, 0, 0], width: 15 },
          { text: payment.method, padding: [0, 0, 0, 0], width: 12 },
          { text: payment.status, padding: [0, 0, 0, 0], width: 12 },
          {
            text: moment(payment.paidAt).format("YYYY-MM-DD HH:mm"),
            padding: [0, 0, 0, 0],
            width: 20
          },
          { text: payment.loanId, padding: [0, 0, 0, 0], width: 40 }
        );
      });

      this.log(ui.toString());
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
