/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { confirm } from "@inquirer/prompts";
import { Flags } from "@oclif/core";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import {
  promptTextIfMissing,
  promptNumberIfMissing,
  promptSelectIfMissing
} from "../../lib/prompts.js";

export default class Create extends BaseCommand<typeof Create> {
  static override readonly description = "create a new loan for a customer";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --customer-id abc-def --principal 10000 --term-length 30 --payment-amount 500 --payment-frequency WEEKLY"
  ];
  static override readonly flags = {
    "customer-id": Flags.string({
      description: "Customer ID",
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
      options: ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"],
      required: false
    }),
    "starting-date": Flags.string({
      description:
        "Starting date for payment cycles (ISO date, e.g. 2026-02-15). Defaults to loan creation date.",
      required: false
    }),
    nickname: Flags.string({
      description: "Optional nickname for the loan (e.g. business name for reports)",
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

    this.log("This utility will help you create a Loan.");
    this.log("Press ^C at any time to quit.");

    const customerId = await promptTextIfMissing(
      flags["customer-id"],
      "Customer ID",
      "customer-id"
    );
    const principal = await promptNumberIfMissing(flags.principal, "Principal Amount", "principal");
    const paymentFrequency = await promptSelectIfMissing(
      flags["payment-frequency"] as "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | undefined,
      "Payment Frequency",
      "payment-frequency",
      [
        { name: "Daily (Diario)", value: "DAILY" as const },
        { name: "Weekly (Semanal)", value: "WEEKLY" as const },
        { name: "Biweekly (Quincenal)", value: "BIWEEKLY" as const },
        { name: "Monthly (Mensual)", value: "MONTHLY" as const }
      ]
    );
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
    const today = new Date().toISOString().slice(0, 10);
    const startingDateStr = await promptTextIfMissing(
      flags["starting-date"],
      "Starting date (YYYY-MM-DD)",
      "starting-date",
      { default: today }
    );
    const startingDate = new Date(startingDateStr);
    const nicknameStr = await promptTextIfMissing(
      flags.nickname,
      "Nickname (optional, press Enter to skip)",
      "nickname",
      { default: "" }
    );
    const nickname = nicknameStr?.trim() || undefined;
    const type = (flags.type || "SAN") as "SAN";

    const ready = await confirm({ message: "Ready to create loan?" });

    if (!ready) {
      this.log("Aborted!");
      return;
    }

    try {
      const loan = await client.createLoan.mutate({
        customerId,
        principal,
        termLength,
        paymentAmount,
        paymentFrequency,
        startingDate,
        ...(nickname !== undefined && { nickname }),
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
