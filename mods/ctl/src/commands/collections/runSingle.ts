/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { RunSingleCollectionInput } from "@mikro/common";
import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import { promptLoanSelectIfMissing } from "../../lib/prompts.js";

const CHANNEL_OPTIONS = ["WHATSAPP", "PHONE_CALL"] as const;
const TYPE_OPTIONS = ["PAYMENT_REMINDER", "OVERDUE_NOTICE", "COLLECTION_CALL"] as const;

export default class RunSingle extends BaseCommand<typeof RunSingle> {
  static override readonly description =
    "run a single collection action for one loan (override channel/type, dry-run supported)";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> 10019",
    "<%= config.bin %> <%= command.id %> 10019 --dry-run",
    "<%= config.bin %> <%= command.id %> 10019 --type OVERDUE_NOTICE",
    "<%= config.bin %> <%= command.id %> 10019 --channel WHATSAPP --type PAYMENT_REMINDER",
    "<%= config.bin %> <%= command.id %> 10019 --app-ref f1777c6e-e825-45f7-91e2-af1b497f064b"
  ];

  static override readonly args = {
    loanId: Args.string({
      description: "Numeric loan ID (e.g. 10019)",
      required: false
    })
  };

  static override readonly flags = {
    "dry-run": Flags.boolean({
      description: "Log what would happen without sending messages/calls or writing records",
      default: false
    }),
    channel: Flags.string({
      description: "Force channel for this collection",
      required: false,
      options: [...CHANNEL_OPTIONS]
    }),
    type: Flags.string({
      description: "Force collection type for this collection",
      required: false,
      options: [...TYPE_OPTIONS]
    }),
    "app-ref": Flags.string({
      description: "Override the Fonoster appRef used for collection calls in this run",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(RunSingle);
    const client = this.createClient();
    const dryRun = flags["dry-run"];
    const channel = flags.channel;
    const type = flags.type;
    const appRef = flags["app-ref"];

    const loanId = await promptLoanSelectIfMissing(client, args.loanId, "Loan ID", "loanId", {
      showAll: true
    });

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
        includeDefaulted: true,
        appRef
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
  }
}
