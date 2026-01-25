/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { confirm, input, number, select } from "@inquirer/prompts";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

export default class Create extends BaseCommand<typeof Create> {
  static override readonly description = "create a new payment for a loan";
  static override readonly examples = ["<%= config.bin %> <%= command.id %>"];

  public async run(): Promise<void> {
    const client = this.createClient();

    this.log("This utility will help you create a Payment.");
    this.log("Press ^C at any time to quit.");

    const answers = {
      loanId: await number({
        message: "Loan ID (numeric, e.g., 10000, 10001)",
        required: true
      }),
      amount: await number({
        message: "Amount",
        required: true
      }),
      method: await select({
        message: "Payment Method",
        choices: [
          { name: "Cash", value: "CASH" as const },
          { name: "Transfer", value: "TRANSFER" as const }
        ],
        default: "CASH"
      }),
      collectedById: await input({
        message: "Collector ID (optional)",
        required: false
      }),
      notes: await input({
        message: "Notes (optional)",
        required: false
      })
    };

    const ready = await confirm({
      message: "Ready to create payment?"
    });

    if (!ready) {
      this.log("Aborted!");
      return;
    }

    try {
      const payment = await client.createPayment.mutate({
        loanId: answers.loanId,
        amount: answers.amount!,
        method: answers.method,
        collectedById: answers.collectedById || undefined,
        notes: answers.notes || undefined
      });

      this.log("Done!");
      this.log(`Payment ID: ${payment.id}`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
