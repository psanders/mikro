/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import {
  promptNumberIfMissing,
  promptSelectIfMissing,
  promptConfirmIfMissing
} from "../../lib/prompts.js";

const STATUS_OPTIONS = ["COMPLETED", "DEFAULTED", "CANCELLED"] as const;
type StatusOption = (typeof STATUS_OPTIONS)[number];

export default class UpdateLoanStatus extends BaseCommand<typeof UpdateLoanStatus> {
  static override readonly description =
    "set a loan's status to COMPLETED, DEFAULTED, or CANCELLED";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --loan-id 10001 --status COMPLETED --yes"
  ];
  static override readonly flags = {
    "loan-id": Flags.integer({
      description: "Numeric loan ID (e.g. 10000, 10001)",
      required: false
    }),
    status: Flags.string({
      description: "New status",
      options: [...STATUS_OPTIONS],
      required: false
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(UpdateLoanStatus);
    const client = this.createClient();

    if (!flags.yes) {
      this.log("This utility will update a loan's status.");
      this.log("Press ^C at any time to quit.");
    }

    const loanId = await promptNumberIfMissing(
      flags["loan-id"],
      "Loan ID (numeric, e.g. 10001)",
      "loan-id"
    );
    const status = await promptSelectIfMissing<StatusOption>(
      flags.status as StatusOption | undefined,
      "New status",
      "status",
      [
        { name: "Completed", value: "COMPLETED" as const },
        { name: "Defaulted", value: "DEFAULTED" as const },
        { name: "Cancelled", value: "CANCELLED" as const }
      ]
    );

    const ready = await promptConfirmIfMissing(
      flags.yes ? true : undefined,
      `Set loan #${loanId} to ${status}?`,
      "yes"
    );

    if (!ready) {
      this.log("Aborted!");
      return;
    }

    try {
      const result = await client.updateLoanStatus.mutate({ loanId, status });
      this.log("Done!");
      this.log(`Loan #${result.loanId} status set to ${result.status}.`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
