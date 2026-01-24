/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { confirm, input } from "@inquirer/prompts";
import { Args } from "@oclif/core";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

export default class Reverse extends BaseCommand<typeof Reverse> {
  static override readonly description = "reverse a payment";
  static override readonly examples = ["<%= config.bin %> <%= command.id %> <payment-id>"];
  static override readonly args = {
    ref: Args.string({
      description: "The Payment ID to reverse",
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(Reverse);
    const client = this.createClient();

    this.log("This utility will help you reverse a Payment.");
    this.log("Press ^C at any time to quit.");

    const notes = await input({
      message: "Notes (reason for reversal)",
      required: false,
    });

    const ready = await confirm({
      message: "Are you sure you want to reverse this payment?",
    });

    if (!ready) {
      this.log("Aborted!");
      return;
    }

    try {
      await client.reversePayment.mutate({
        id: args.ref,
        notes: notes || undefined,
      });

      this.log("Done! Payment has been reversed.");
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
