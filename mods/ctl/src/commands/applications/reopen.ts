/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";
import { promptApplicationSelectIfMissing } from "../../lib/prompts.js";

export default class Reopen extends MutationCommand<typeof Reopen> {
  static override readonly description = "reopen an APPROVED or REJECTED application for review";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <applicationId>",
    "<%= config.bin %> <%= command.id %> <applicationId> --note 'Cliente aportó nueva información'"
  ];
  static override readonly args = {
    applicationId: Args.string({
      description: "The application ID to reopen",
      required: false
    })
  };
  static override readonly flags = {
    note: Flags.string({ description: "Optional review note", required: false })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Reopen);
    const client = this.createClient();

    const applicationId = await promptApplicationSelectIfMissing(
      client,
      args.applicationId,
      "Application to reopen",
      "applicationId"
    );

    const ready = await this.confirmOrAbort(`Reopen application ${applicationId} for review?`);
    if (!ready) return;

    try {
      await client.reopenApplication.mutate({ id: applicationId, note: flags.note });
      this.log("Done!");
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
