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
  static override readonly description = "create a new loan for a member";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --member-id abc-def --principal 10000 --term-length 30 --payment-amount 500 --payment-frequency WEEKLY --yes"
  ];
  static override readonly flags = {
    "member-id": Flags.string({
      description: "Member ID",
      required: false
    }),
    principal: Flags.integer({
      description: "Principal Amount",
      required: false
    }),
    "term-length": Flags.integer({
      description: "Term Length (number of periods)",
      required: false
    }),
    "payment-amount": Flags.integer({
      description: "Payment Amount (per period)",
      required: false
    }),
    "payment-frequency": Flags.string({
      description: "Payment Frequency",
      options: ["DAILY", "WEEKLY"],
      required: false
    }),
    type: Flags.string({
      description: "Loan Type",
      options: ["SAN"],
      default: "SAN",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Create);
    const client = this.createClient();

    if (!flags.yes) {
      this.log("This utility will help you create a Loan.");
      this.log("Press ^C at any time to quit.");
    }

    const memberId = await promptTextIfMissing(flags["member-id"], "Member ID", "member-id");
    const principal = await promptNumberIfMissing(flags.principal, "Principal Amount", "principal");
    const termLength = await promptNumberIfMissing(
      flags["term-length"],
      "Term Length (number of periods)",
      "term-length"
    );
    const paymentAmount = await promptNumberIfMissing(
      flags["payment-amount"],
      "Payment Amount (per period)",
      "payment-amount"
    );
    const paymentFrequency = await promptSelectIfMissing(
      flags["payment-frequency"] as "DAILY" | "WEEKLY" | undefined,
      "Payment Frequency",
      "payment-frequency",
      [
        { name: "Daily", value: "DAILY" as const },
        { name: "Weekly", value: "WEEKLY" as const }
      ]
    );
    const type = (flags.type || "SAN") as "SAN";

    const ready = await promptConfirmIfMissing(
      flags.yes ? true : undefined,
      "Ready to create loan?",
      "yes"
    );

    if (!ready) {
      this.log("Aborted!");
      return;
    }

    try {
      const loan = await client.createLoan.mutate({
        memberId,
        principal,
        termLength,
        paymentAmount,
        paymentFrequency,
        type
      });

      this.log("Done!");
      this.log(`Loan ID: ${loan.id}`);
      this.log(`Loan Number: ${loan.loanId}`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
