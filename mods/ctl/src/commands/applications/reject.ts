/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";
import { promptApplicationSelectIfMissing, promptTextIfMissing } from "../../lib/prompts.js";

export default class Reject extends MutationCommand<typeof Reject> {
  static override readonly description =
    "reject an application (assignee while IN_REVIEW, admin while PENDING_DECISION)";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <applicationId> --reason PAYMENT_CAPACITY",
    "<%= config.bin %> <%= command.id %> <applicationId> --reason OTHER --note 'Negocio cerrado'"
  ];
  static override readonly args = {
    applicationId: Args.string({
      description: "The application ID to reject",
      required: false
    })
  };
  static override readonly flags = {
    reason: Flags.string({
      description: "Rejection reason",
      options: ["OUT_OF_COVERAGE_AREA", "PAYMENT_CAPACITY", "DOCUMENTS", "OTHER"],
      required: true
    }),
    note: Flags.string({ description: "Note (required when reason is OTHER)", required: false })
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
    const reason = flags.reason as
      | "OUT_OF_COVERAGE_AREA"
      | "PAYMENT_CAPACITY"
      | "DOCUMENTS"
      | "OTHER";
    const note =
      reason === "OTHER" ? await promptTextIfMissing(flags.note, "Note", "note") : flags.note;

    const ready = await this.confirmOrAbort(`Reject application ${applicationId}?`);
    if (!ready) return;

    try {
      await client.rejectApplication.mutate({ id: applicationId, reason, note });
      this.log("Done!");
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
