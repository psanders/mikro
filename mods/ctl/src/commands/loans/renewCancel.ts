/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";

export default class RenewCancel extends MutationCommand<typeof RenewCancel> {
  static override readonly description =
    "cancel a renewal before it is finalized. The old loan stays active and nothing is posted";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <renewalId> --reason 'customer changed their mind'"
  ];
  static override readonly args = {
    renewalId: Args.string({ description: "Renewal ID", required: true })
  };
  static override readonly flags = {
    reason: Flags.string({ description: "Why it was cancelled", required: false })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(RenewCancel);
    const client = this.createClient();
    try {
      const ready = await this.confirmOrAbort("Cancel this renewal?");
      if (!ready) return;
      const renewal = await client.cancelLoanRenewal.mutate({
        id: args.renewalId,
        ...(flags.reason && { reason: flags.reason })
      });
      this.log(`Renewal cancelled. Loan #${renewal.loan.loanId} stays ${renewal.loan.status}.`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
