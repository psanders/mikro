/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args } from "@oclif/core";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";
import { promptApplicationSelectIfMissing } from "../../lib/prompts.js";

export default class Delete extends MutationCommand<typeof Delete> {
  static override readonly description =
    "delete a loan application (recoverable for 30 days via the founder feed's restore)";
  static override readonly examples = ["<%= config.bin %> <%= command.id %> <applicationId>"];
  static override readonly args = {
    applicationId: Args.string({
      description: "The application ID to delete",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(Delete);
    const client = this.createClient();

    const applicationId = await promptApplicationSelectIfMissing(
      client,
      args.applicationId,
      "Application to delete",
      "applicationId"
    );

    const ready = await this.confirmOrAbort(
      `Delete application ${applicationId}? This can be restored within 30 days from the founder feed.`
    );
    if (!ready) return;

    try {
      await client.deleteApplication.mutate({ id: applicationId });
      this.log("Done!");
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
