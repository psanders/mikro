/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";
import { promptTextIfMissing, promptPaymentSelectIfMissing } from "../../lib/prompts.js";

export default class Reverse extends MutationCommand<typeof Reverse> {
  static override readonly description = "reverse a payment";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <paymentId>",
    "<%= config.bin %> <%= command.id %> <paymentId> --notes 'Duplicate entry'"
  ];
  static override readonly args = {
    paymentId: Args.string({
      description: "The Payment ID to reverse",
      required: false
    })
  };
  static override readonly flags = {
    notes: Flags.string({
      description: "Notes (reason for reversal)",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Reverse);
    const client = this.createClient();

    this.log("This utility will help you reverse a Payment.");
    this.log("Press ^C at any time to quit.");

    const paymentId = await promptPaymentSelectIfMissing(
      client,
      args.paymentId,
      "Payment",
      "paymentId"
    );

    const notes =
      flags.notes !== undefined
        ? flags.notes
        : process.stdout.isTTY
          ? await promptTextIfMissing(undefined, "Notes (reason for reversal)", "notes", {
              required: false,
              default: ""
            })
          : undefined;

    const ready = await this.confirmOrAbort(
      `Are you sure you want to reverse payment ${paymentId}?`
    );
    if (!ready) return;

    try {
      await client.reversePayment.mutate({
        id: paymentId,
        notes: notes || undefined
      });

      this.log("Done! Payment has been reversed.");
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
