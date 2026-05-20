/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";
import { promptSelectIfMissing, promptLoanSelectIfMissing } from "../../lib/prompts.js";

const STATUS_OPTIONS = ["COMPLETED", "DEFAULTED", "CANCELLED"] as const;
type StatusOption = (typeof STATUS_OPTIONS)[number];

export default class UpdateLoanStatus extends MutationCommand<typeof UpdateLoanStatus> {
  static override readonly description =
    "set a loan's status to COMPLETED, DEFAULTED, or CANCELLED";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> 10001 --status COMPLETED"
  ];
  static override readonly args = {
    loanId: Args.string({
      description: "Numeric loan ID (e.g. 10000, 10001)",
      required: false
    })
  };
  static override readonly flags = {
    status: Flags.string({
      description: "New status",
      options: [...STATUS_OPTIONS],
      required: false
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(UpdateLoanStatus);
    const client = this.createClient();

    this.log("This utility will update a loan's status.");
    this.log("Press ^C at any time to quit.");

    const loanId = await promptLoanSelectIfMissing(
      client,
      args.loanId,
      "Loan ID (numeric, e.g. 10001)",
      "loanId"
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

    const ready = await this.confirmOrAbort(`Set loan #${loanId} to ${status}?`);
    if (!ready) return;

    try {
      const result = await client.updateLoanStatus.mutate({ loanId, status });
      this.log("Done!");
      this.log(`Loan #${result.loanId} status set to ${result.status}.`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
