/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { RunCollectionsInput, RunSingleCollectionInput } from "@mikro/common";
import { Flags } from "@oclif/core";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

const CHANNEL_OPTIONS = ["WHATSAPP", "PHONE_CALL"] as const;
const TYPE_OPTIONS = ["PAYMENT_REMINDER", "OVERDUE_NOTICE", "COLLECTION_CALL"] as const;

export default class Run extends BaseCommand<typeof Run> {
  static override readonly description =
    "run the daily collections process now, or a single collection action for one loan";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --dry-run",
    "<%= config.bin %> <%= command.id %> --dry-run --yes",
    "<%= config.bin %> <%= command.id %> --loan-id 10019",
    "<%= config.bin %> <%= command.id %> --loan-id 10019 --type OVERDUE_NOTICE",
    "<%= config.bin %> <%= command.id %> --loan-id 10019 --channel WHATSAPP --type PAYMENT_REMINDER",
    "<%= config.bin %> <%= command.id %> --loan-id 10019 --dry-run"
  ];

  static override readonly flags = {
    "dry-run": Flags.boolean({
      description: "Log what would happen without sending messages/calls or writing records",
      default: false
    }),
    "loan-id": Flags.integer({
      description:
        "Run a single collection action for this loan (numeric ID). When set, --channel and --type can override channel/type.",
      required: false
    }),
    channel: Flags.string({
      description: "Force channel for single collection (only with --loan-id)",
      required: false,
      options: [...CHANNEL_OPTIONS]
    }),
    type: Flags.string({
      description: "Force collection type for single collection (only with --loan-id)",
      required: false,
      options: [...TYPE_OPTIONS]
    }),
    "include-defaulted": Flags.boolean({
      description:
        "Include loans with status DEFAULTED (batch only; single collection always includes defaulted)",
      default: false
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Run);
    const client = this.createClient();
    const dryRun = flags["dry-run"];
    const loanId = flags["loan-id"];
    const channel = flags.channel;
    const type = flags.type;

    if ((channel !== undefined || type !== undefined) && loanId === undefined) {
      this.error("--channel and --type can only be used with --loan-id");
    }

    if (loanId !== undefined) {
      if (dryRun) {
        this.log(`Running single collection for loan ${loanId} in DRY RUN mode...`);
      } else {
        this.log(`Running single collection for loan ${loanId}...`);
      }
      try {
        const singleInput: RunSingleCollectionInput = {
          loanId,
          channel: (channel as (typeof CHANNEL_OPTIONS)[number]) ?? undefined,
          type: (type as (typeof TYPE_OPTIONS)[number]) ?? undefined,
          dryRun,
          includeDefaulted: true
        };
        const result = await client.runSingleCollection.mutate(
          singleInput as Parameters<typeof client.runSingleCollection.mutate>[0]
        );
        if (!result.success) {
          this.error(result.error ?? "Single collection failed");
        }
        if (result.dryRun) {
          this.log(
            `\nDry run complete. Would send ${result.type} via ${result.channel} to ${result.customerName} (loan #${result.loanId}).`
          );
        } else {
          this.log(
            `\nDone. Sent ${result.type} via ${result.channel} to ${result.customerName} (loan #${result.loanId}).`
          );
        }
      } catch (e) {
        errorHandler(e, this.error.bind(this));
      }
      return;
    }

    if (dryRun) {
      this.log("Running collections in DRY RUN mode (no messages will be sent)...");
    } else {
      this.log("Running collections...");
    }

    try {
      const batchInput: RunCollectionsInput = {
        dryRun,
        includeDefaulted: flags["include-defaulted"]
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
