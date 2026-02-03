/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import cliui from "cliui";
import moment from "moment";
import { ListCommand } from "../../ListCommand.js";
import { validateDate } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

export default class ListByReferrer extends ListCommand<typeof ListByReferrer> {
  static override readonly description = "display payments for members referred by a specific user";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <referrerId> --start-date 2026-01-01 --end-date 2026-01-31"
  ];
  static override readonly args = {
    referrerId: Args.string({
      description: "The Referrer ID to filter by",
      required: true
    })
  };
  static override readonly flags = {
    "start-date": Flags.string({
      description: "start date (YYYY-MM-DD)",
      required: true
    }),
    "end-date": Flags.string({
      description: "end date (YYYY-MM-DD)",
      required: true
    }),
    "include-reversed": Flags.boolean({
      char: "a",
      description: "include reversed payments",
      default: false
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(ListByReferrer);
    const client = this.createClient();

    // Validate date formats
    validateDate(flags["start-date"]!);
    validateDate(flags["end-date"]!);

    try {
      const payments = await client.listPaymentsByReferrer.query({
        referredById: args.referrerId,
        startDate: new Date(flags["start-date"]!),
        endDate: new Date(flags["end-date"]!),
        showReversed: flags["include-reversed"],
        limit: flags["page-size"]
      });

      const ui = cliui({ width: 200 });

      ui.div(
        { text: "ID", padding: [0, 0, 0, 0], width: 38 },
        { text: "LOAN #", padding: [0, 0, 0, 0], width: 10 },
        { text: "MEMBER NAME", padding: [0, 0, 0, 0], width: 30 },
        { text: "AMOUNT", padding: [0, 0, 0, 0], width: 15 },
        { text: "METHOD", padding: [0, 0, 0, 0], width: 12 },
        { text: "STATUS", padding: [0, 0, 0, 0], width: 12 },
        { text: "PAID AT", padding: [0, 0, 0, 0], width: 20 }
      );

      payments.forEach((payment) => {
        ui.div(
          { text: payment.id, padding: [0, 0, 0, 0], width: 38 },
          { text: String(payment.loan.loanId), padding: [0, 0, 0, 0], width: 10 },
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
