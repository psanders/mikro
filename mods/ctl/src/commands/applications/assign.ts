/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import { select } from "@inquirer/prompts";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";
import { promptApplicationSelectIfMissing, promptUserSelectIfMissing } from "../../lib/prompts.js";

/**
 * ctl users are admins/reviewers coordinating a queue, not the applicant, so
 * the default expectation is assigning a RECEIVED application to *someone* —
 * self-assignment is offered as one option among reviewers, not baked in as
 * the only path (that's what the old `claim` framing got wrong).
 */
export default class Assign extends MutationCommand<typeof Assign> {
  static override readonly description =
    "assign a RECEIVED application to a reviewer for review (yourself or someone else)";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <applicationId>",
    "<%= config.bin %> <%= command.id %> <applicationId> --assignee <userId>",
    "<%= config.bin %> <%= command.id %>"
  ];

  static override readonly args = {
    applicationId: Args.string({
      description: "The application ID to assign",
      required: false
    })
  };

  static override readonly flags = {
    assignee: Flags.string({
      description: "User ID to assign the application to (omit to choose interactively)"
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Assign);
    const client = this.createClient();

    const applicationId = await promptApplicationSelectIfMissing(
      client,
      args.applicationId,
      "Application to assign",
      "applicationId",
      { status: "RECEIVED" }
    );

    let assigneeId = flags.assignee;
    if (!assigneeId) {
      if (!process.stdout.isTTY) {
        throw new Error("Missing required flag: --assignee");
      }
      const me = await client.whoami.query();
      const target = await select({
        message: "Assign to",
        choices: [
          { name: `Myself (${me.name})`, value: "__self__" },
          { name: "Someone else...", value: "__other__" }
        ]
      });
      assigneeId =
        target === "__self__"
          ? me.id
          : await promptUserSelectIfMissing(client, undefined, "Assign to", "assignee", {
              roles: ["ADMIN", "REVIEWER"]
            });
    }

    const assignee = await client.getUser.query({ id: assigneeId });
    const assigneeLabel = assignee ? `${assignee.name} (${assigneeId})` : assigneeId;

    const ready = await this.confirmOrAbort(
      `Assign application ${applicationId} to ${assigneeLabel}?`
    );
    if (!ready) return;

    try {
      await client.claimApplication.mutate({ id: applicationId, assigneeId });
      this.log(`Done! Assigned to ${assigneeLabel}.`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
