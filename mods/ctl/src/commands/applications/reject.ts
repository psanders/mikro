/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";
import { promptApplicationSelectIfMissing, promptTextIfMissing } from "../../lib/prompts.js";

export default class Reject extends MutationCommand<typeof Reject> {
  static override readonly description = "reject a RECEIVED or IN_REVIEW application";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <applicationId> --reason 'Fuera de zona de cobertura'"
  ];
  static override readonly args = {
    applicationId: Args.string({
      description: "The application ID to reject",
      required: false
    })
  };
  static override readonly flags = {
    reason: Flags.string({ description: "Rejection reason (required)", required: false })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Reject);
    const client = this.createClient();

    const applicationId = await promptApplicationSelectIfMissing(
      client,
      args.applicationId,
      "Application to reject",
      "applicationId"
    );
    const reason = await promptTextIfMissing(flags.reason, "Rejection reason", "reason");

    const ready = await this.confirmOrAbort(`Reject application ${applicationId}?`);
    if (!ready) return;

    try {
      await client.rejectApplication.mutate({ id: applicationId, reason });
      this.log("Done!");
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
