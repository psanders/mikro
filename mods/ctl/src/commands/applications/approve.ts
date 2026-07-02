/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";
import { promptApplicationSelectIfMissing } from "../../lib/prompts.js";

export default class Approve extends MutationCommand<typeof Approve> {
  static override readonly description = "approve a RECEIVED or IN_REVIEW application";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <applicationId>",
    "<%= config.bin %> <%= command.id %> <applicationId> --note 'Buen historial de negocio'"
  ];
  static override readonly args = {
    applicationId: Args.string({
      description: "The application ID to approve",
      required: false
    })
  };
  static override readonly flags = {
    note: Flags.string({ description: "Optional review note", required: false })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Approve);
    const client = this.createClient();

    const applicationId = await promptApplicationSelectIfMissing(
      client,
      args.applicationId,
      "Application to approve",
      "applicationId"
    );

    const ready = await this.confirmOrAbort(`Approve application ${applicationId}?`);
    if (!ready) return;

    try {
      await client.approveApplication.mutate({ id: applicationId, note: flags.note });
      this.log("Done!");
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
