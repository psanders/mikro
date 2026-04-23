/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { confirm } from "@inquirer/prompts";
import { formatMoney } from "@mikro/common";
import { Flags } from "@oclif/core";
import { BaseCommand } from "../../../BaseCommand.js";
import errorHandler from "../../../errorHandler.js";
import {
  promptNumberIfMissing,
  promptSelectIfMissing,
  promptTextIfMissing
} from "../../../lib/prompts.js";

type AccountKind = "BANK" | "CASH" | "CREDIT_CARD" | "OTHER";

export default class Create extends BaseCommand<typeof Create> {
  static override readonly description =
    "create a new accounting account (bank, cash, credit card)";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    '<%= config.bin %> <%= command.id %> --name "Banreservas Corriente" --kind BANK --opening-balance 125000'
  ];
  static override readonly flags = {
    name: Flags.string({ description: "Account name", required: false }),
    kind: Flags.string({
      description: "Account kind",
      options: ["BANK", "CASH", "CREDIT_CARD", "OTHER"],
      required: false
    }),
    currency: Flags.string({
      description: "ISO-4217 currency code (e.g. DOP, USD)",
      required: false
    }),
    "opening-balance": Flags.integer({
      description: "Opening balance (also sets current balance)",
      required: false
    }),
    notes: Flags.string({ description: "Notes (optional)", required: false })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Create);
    const client = this.createClient();

    this.log("Create a new accounting account. Press ^C at any time to quit.");

    const name = await promptTextIfMissing(flags.name, "Account name", "name");
    const kind = await promptSelectIfMissing<AccountKind>(
      flags.kind as AccountKind | undefined,
      "Account kind",
      "kind",
      [
        { name: "Bank", value: "BANK" },
        { name: "Cash", value: "CASH" },
        { name: "Credit Card", value: "CREDIT_CARD" },
        { name: "Other", value: "OTHER" }
      ],
      { default: "BANK" }
    );
    const currency = await promptTextIfMissing(
      flags.currency,
      "Currency (ISO-4217, e.g. DOP)",
      "currency",
      { default: "DOP" }
    );
    const openingBalance = await promptNumberIfMissing(
      flags["opening-balance"],
      "Opening balance",
      "opening-balance",
      { required: false }
    );

    const ready = await confirm({ message: "Create this account?", default: true });
    if (!ready) {
      this.log("Aborted!");
      return;
    }

    try {
      const account = await client.accounting.createAccount.mutate({
        name,
        kind,
        currency,
        openingBalance,
        ...(flags.notes ? { notes: flags.notes } : {})
      });
      this.log("Account created.");
      this.log(`  ID: ${account.id}`);
      this.log(`  Name: ${account.name}`);
      this.log(`  Kind: ${account.kind}`);
      this.log(`  Currency: ${account.currency}`);
      this.log(`  Balance: ${formatMoney(account.currentBalance)}`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
