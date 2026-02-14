/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

export default class Run extends BaseCommand<typeof Run> {
  static override readonly description =
    "run the daily collections process now (reminders, overdue notices, collection calls)";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --dry-run",
    "<%= config.bin %> <%= command.id %> --dry-run --yes"
  ];

  static override readonly flags = {
    "dry-run": Flags.boolean({
      description: "Log what would happen without sending messages/calls or writing records",
      default: false
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Run);
    const client = this.createClient();
    const dryRun = flags["dry-run"];

    if (dryRun) {
      this.log("Running collections in DRY RUN mode (no messages will be sent)...");
    } else {
      this.log("Running collections...");
    }

    try {
      const result = await client.runCollections.mutate({ dryRun });

      if (result.dryRun) {
        this.log("\nDry run complete. Check server logs for details on what would be sent.");
      } else {
        this.log("\nCollections run complete. Check server logs for details.");
      }
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
