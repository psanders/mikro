/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { RunCollectionsInput } from "@mikro/common";
import { Flags } from "@oclif/core";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

export default class Run extends BaseCommand<typeof Run> {
  static override readonly description = "run the daily collections process for all eligible loans";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --dry-run",
    "<%= config.bin %> <%= command.id %> --include-defaulted",
    "<%= config.bin %> <%= command.id %> --app-ref f1777c6e-e825-45f7-91e2-af1b497f064b"
  ];

  static override readonly flags = {
    "dry-run": Flags.boolean({
      description: "Log what would happen without sending messages/calls or writing records",
      default: false
    }),
    "include-defaulted": Flags.boolean({
      description: "Include loans with status DEFAULTED",
      default: false
    }),
    "app-ref": Flags.string({
      description: "Override the Fonoster appRef used for collection calls in this run",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Run);
    const client = this.createClient();
    const dryRun = flags["dry-run"];
    const appRef = flags["app-ref"];

    if (dryRun) {
      this.log("Running collections in DRY RUN mode (no messages will be sent)...");
    } else {
      this.log("Running collections...");
    }

    try {
      const batchInput: RunCollectionsInput = {
        dryRun,
        includeDefaulted: flags["include-defaulted"],
        appRef
      };
      const result = await client.runCollections.mutate(
        batchInput as Parameters<typeof client.runCollections.mutate>[0]
      );

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
