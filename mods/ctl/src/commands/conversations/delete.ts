/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Delete a phone's whole WhatsApp CX transcript (issue #299). Transcripts are
 * kept until a person asks for their data to be removed; this is that removal.
 * It does not touch Chatwoot, hand-off records or applications.
 */
import { Args } from "@oclif/core";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";

export default class ConversationsDelete extends MutationCommand<typeof ConversationsDelete> {
  static override readonly description =
    "permanently delete every stored WhatsApp CX message for a phone (data-removal requests)";
  static override readonly examples = ["<%= config.bin %> <%= command.id %> +18095551234"];
  static override readonly args = {
    phone: Args.string({
      description: "The phone whose transcript to delete (E.164, e.g. +18095551234)",
      required: true
    })
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(ConversationsDelete);
    const client = this.createClient();

    const ready = await this.confirmOrAbort(
      `Permanently delete every stored WhatsApp message for ${args.phone}? This cannot be undone (Chatwoot keeps its own copy).`
    );
    if (!ready) return;

    try {
      const { deleted } = await client.deleteConversation.mutate({ phone: args.phone });
      this.log(`Deleted ${deleted} message${deleted === 1 ? "" : "s"}.`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
