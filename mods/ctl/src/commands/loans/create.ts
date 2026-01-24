/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { confirm, input, number, select } from "@inquirer/prompts";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

export default class Create extends BaseCommand<typeof Create> {
  static override readonly description = "create a new loan for a member";
  static override readonly examples = ["<%= config.bin %> <%= command.id %>"];

  public async run(): Promise<void> {
    const client = this.createClient();

    this.log("This utility will help you create a Loan.");
    this.log("Press ^C at any time to quit.");

    const answers = {
      memberId: await input({
        message: "Member ID",
        required: true
      }),
      principal: await number({
        message: "Principal Amount",
        required: true
      }),
      termLength: await number({
        message: "Term Length (number of periods)",
        required: true
      }),
      paymentAmount: await number({
        message: "Payment Amount (per period)",
        required: true
      }),
      paymentFrequency: await select({
        message: "Payment Frequency",
        choices: [
          { name: "Daily", value: "DAILY" as const },
          { name: "Weekly", value: "WEEKLY" as const }
        ]
      }),
      type: await select({
        message: "Loan Type",
        choices: [{ name: "SAN (Fixed periodic payments)", value: "SAN" as const }],
        default: "SAN"
      })
    };

    const ready = await confirm({
      message: "Ready to create loan?"
    });

    if (!ready) {
      this.log("Aborted!");
      return;
    }

    try {
      const loan = await client.createLoan.mutate({
        memberId: answers.memberId,
        principal: answers.principal!,
        termLength: answers.termLength!,
        paymentAmount: answers.paymentAmount!,
        paymentFrequency: answers.paymentFrequency,
        type: answers.type
      });

      this.log("Done!");
      this.log(`Loan ID: ${loan.id}`);
      this.log(`Loan Number: ${loan.loanId}`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
