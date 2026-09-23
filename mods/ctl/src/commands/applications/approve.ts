/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";
import { promptApplicationSelectIfMissing } from "../../lib/prompts.js";

export default class Approve extends MutationCommand<typeof Approve> {
  static override readonly description =
    "approve an application waiting for decision (PENDING_DECISION), with the terms to lend";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <applicationId> --amount 10000 --weeks 10",
    "<%= config.bin %> <%= command.id %> <applicationId> --amount 10000 --weeks 10 --note 'Buen historial de negocio'"
  ];
  static override readonly args = {
    applicationId: Args.string({
      description: "The application ID to approve",
      required: false
    })
  };
  static override readonly flags = {
    amount: Flags.integer({ description: "Approved amount (RD$)", required: true }),
    weeks: Flags.integer({ description: "Approved term in weeks", required: true }),
    note: Flags.string({ description: "Optional decision note", required: false })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Approve);
    const client = this.createClient();

    const applicationId = await promptApplicationSelectIfMissing(
      client,
      args.applicationId,
      "Application to approve",
      "applicationId",
      { status: "PENDING_DECISION" }
    );

    const ready = await this.confirmOrAbort(`Approve application ${applicationId}?`);
    if (!ready) return;

    try {
      await client.approveApplication.mutate({
        id: applicationId,
        approvedAmount: flags.amount,
        approvedTermWeeks: flags.weeks,
        note: flags.note
      });
      this.log("Done!");
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
