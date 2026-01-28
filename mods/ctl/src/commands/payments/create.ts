/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import {
  promptTextIfMissing,
  promptNumberIfMissing,
  promptSelectIfMissing,
  promptConfirmIfMissing
} from "../../lib/prompts.js";

export default class Create extends BaseCommand<typeof Create> {
  static override readonly description = "create a new payment for a loan";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --loan-id 10000 --amount 500 --method CASH --collector-id abc-def --yes"
  ];
  static override readonly flags = {
    "loan-id": Flags.integer({
      description: "Loan ID (numeric, e.g., 10000, 10001)",
      required: false
    }),
    amount: Flags.integer({
      description: "Payment Amount",
      required: false
    }),
    method: Flags.string({
      description: "Payment Method",
      options: ["CASH", "TRANSFER"],
      required: false
    }),
    "collector-id": Flags.string({
      description: "Collector ID",
      required: false
    }),
    notes: Flags.string({
      description: "Notes (optional)",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Create);
    const client = this.createClient();

    if (!flags.yes) {
      this.log("This utility will help you create a Payment.");
      this.log("Press ^C at any time to quit.");
    }

    const loanId = await promptNumberIfMissing(
      flags["loan-id"],
      "Loan ID (numeric, e.g., 10000, 10001)",
      "loan-id"
    );
    const amount = await promptNumberIfMissing(flags.amount, "Amount", "amount");
    const method = await promptSelectIfMissing(
      flags.method as "CASH" | "TRANSFER" | undefined,
      "Payment Method",
      "method",
      [
        { name: "Cash", value: "CASH" as const },
        { name: "Transfer", value: "TRANSFER" as const }
      ],
      { default: "CASH" as const }
    );
    const collectedById = await promptTextIfMissing(
      flags["collector-id"],
      "Collector ID (required)",
      "collector-id"
    );
    const notes = flags.notes || undefined;

    const ready = await promptConfirmIfMissing(
      flags.yes ? true : undefined,
      "Ready to create payment?",
      "yes"
    );

    if (!ready) {
      this.log("Aborted!");
      return;
    }

    try {
      const payment = await client.createPayment.mutate({
        loanId,
        amount,
        method,
        collectedById,
        notes
      });

      this.log("Done!");
      this.log(`Payment ID: ${payment.id}`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
