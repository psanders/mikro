/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args } from "@oclif/core";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";
import { promptTextIfMissing } from "../../lib/prompts.js";

export default class SendPromo extends MutationCommand<typeof SendPromo> {
  static override readonly description =
    "send the loan-application promo template to a phone number";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> +18095550001",
    "<%= config.bin %> <%= command.id %> +18095550001 --yes"
  ];

  static override readonly args = {
    phone: Args.string({
      description: "Recipient phone number (E.164, e.g. +18095550001)",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(SendPromo);
    const client = this.createClient();

    const phone = await promptTextIfMissing(args.phone, "Phone number (E.164)", "phone");

    const ready = await this.confirmOrAbort(`Send promo to ${phone}?`);
    if (!ready) return;

    try {
      const result = await client.sendPromo.mutate({ phone });
      if (result.sent) {
        this.log(`Promo sent. Message ID: ${result.messageId}`);
      } else {
        this.error(`Send failed: ${result.error}`);
      }
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
