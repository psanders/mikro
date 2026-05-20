/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import { formatMoney } from "@mikro/common";
import { MutationCommand } from "../../../MutationCommand.js";
import errorHandler from "../../../errorHandler.js";
import { promptTextIfMissing, promptTransactionSelectIfMissing } from "../../../lib/prompts.js";

export default class Reverse extends MutationCommand<typeof Reverse> {
  static override readonly description =
    "reverse an accounting transaction (creates a mirror transaction and marks the original as REVERSED)";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> <transactionId>",
    "<%= config.bin %> <%= command.id %> <transactionId> --notes 'Duplicate entry'"
  ];
  static override readonly args = {
    transactionId: Args.string({
      description: "Transaction ID to reverse",
      required: false
    })
  };
  static override readonly flags = {
    notes: Flags.string({ description: "Notes / reason for reversal", required: false })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Reverse);
    const client = this.createClient();

    const id = await promptTransactionSelectIfMissing(
      client,
      args.transactionId,
      "Transaction to reverse",
      "transactionId"
    );

    const original = await client.accounting.getTransaction.query({ id });
    if (!original) {
      this.error(`Transaction not found: ${id}`);
      return;
    }
    this.log("About to reverse the following transaction:");
    this.log(`  ID: ${original.id}`);
    this.log(`  Type: ${original.type}`);
    this.log(`  Status: ${original.status}`);
    this.log(`  Account: ${original.account.name}`);
    this.log(`  Amount: ${formatMoney(original.amount)}`);
    this.log(`  Description: ${original.description ?? "-"}`);

    if (original.status === "REVERSED") {
      this.error("This transaction is already reversed.");
      return;
    }

    const notes =
      flags.notes !== undefined
        ? flags.notes
        : process.stdout.isTTY
          ? await promptTextIfMissing(undefined, "Reason for reversal (optional)", "notes", {
              required: false,
              default: ""
            })
          : undefined;

    const ready = await this.confirmOrAbort("Reverse this transaction?", { default: false });
    if (!ready) return;

    try {
      const reversal = await client.accounting.reverseTransaction.mutate({
        id,
        ...(notes ? { notes } : {})
      });
      this.log("Transaction reversed.");
      this.log(`  Reversal ID: ${reversal.id}`);
      this.log(`  Reversal of: ${reversal.reversalOfId}`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
