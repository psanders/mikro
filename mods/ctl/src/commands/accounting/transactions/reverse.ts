/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { confirm } from "@inquirer/prompts";
import { Flags } from "@oclif/core";
import { BaseCommand } from "../../../BaseCommand.js";
import errorHandler from "../../../errorHandler.js";
import { promptTextIfMissing } from "../../../lib/prompts.js";

export default class Reverse extends BaseCommand<typeof Reverse> {
  static override readonly description =
    "reverse an accounting transaction (creates a mirror transaction and marks the original as REVERSED)";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --id <uuid>"
  ];
  static override readonly flags = {
    id: Flags.string({ description: "Transaction ID to reverse", required: false }),
    notes: Flags.string({ description: "Notes / reason for reversal", required: false })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Reverse);
    const client = this.createClient();

    const id = await promptTextIfMissing(flags.id, "Transaction ID", "id");

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
    this.log(`  Amount: ${original.amount}`);
    this.log(`  Description: ${original.description ?? "-"}`);

    if (original.status === "REVERSED") {
      this.error("This transaction is already reversed.");
      return;
    }

    const notes = flags.notes
      ? flags.notes
      : process.stdout.isTTY
        ? await promptTextIfMissing(undefined, "Reason for reversal (optional)", "notes", {
            required: false,
            default: ""
          })
        : undefined;

    const ready = await confirm({
      message: "Reverse this transaction?",
      default: false
    });
    if (!ready) {
      this.log("Aborted!");
      return;
    }

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
