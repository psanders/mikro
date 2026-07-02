/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args } from "@oclif/core";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";
import { promptApplicationSelectIfMissing } from "../../lib/prompts.js";

export default class Claim extends MutationCommand<typeof Claim> {
  static override readonly description = "claim a RECEIVED application for review";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <applicationId>",
    "<%= config.bin %> <%= command.id %>"
  ];
  static override readonly args = {
    applicationId: Args.string({
      description: "The application ID to claim",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(Claim);
    const client = this.createClient();

    const applicationId = await promptApplicationSelectIfMissing(
      client,
      args.applicationId,
      "Application to claim",
      "applicationId",
      { status: "RECEIVED" }
    );

    const ready = await this.confirmOrAbort(`Claim application ${applicationId} for review?`);
    if (!ready) return;

    try {
      await client.claimApplication.mutate({ id: applicationId });
      this.log("Done!");
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
