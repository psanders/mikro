/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";

const money = (n: number) =>
  `RD$ ${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default class RenewFinalize extends MutationCommand<typeof RenewFinalize> {
  static override readonly description =
    "finalize a signed renewal: close the old loan, open the new one and post only the net (new principal − what is still owed) to the ledger";
  static override readonly examples = ["<%= config.bin %> <%= command.id %> <renewalId>"];
  static override readonly args = {
    renewalId: Args.string({ description: "Renewal ID", required: true })
  };
  static override readonly flags = {
    account: Flags.string({
      description: "Disbursement account ID (defaults to accounting.disbursementAccountId)",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(RenewFinalize);
    const client = this.createClient();
    try {
      const quote = await client.getLoanRenewalQuote.query({ id: args.renewalId });
      this.log(`Old loan: \t#${quote.oldLoanNumber}`);
      this.log(
        `Owed today: \t${money(quote.owed)} (${money(quote.remainingBalance)} balance + ${money(quote.moraAccrued)} mora)`
      );
      this.log(`New loan: \t${money(quote.principal)}`);
      this.log(`NET TO DISBURSE: \t${money(quote.net)}`);
      if (quote.changed && quote.quotedNet != null) {
        this.log(`(it was ${money(quote.quotedNet)} when the renewal was last quoted)`);
      }

      const ready = await this.confirmOrAbort(
        `Disburse ${money(quote.net)} and close loan #${quote.oldLoanNumber}? This cannot be undone.`
      );
      if (!ready) return;

      const result = await client.finalizeLoanRenewal.mutate({
        id: args.renewalId,
        confirmedNet: quote.net,
        ...(flags.account && { accountId: flags.account })
      });
      this.log("Done!");
      this.log(`Loan #${result.oldLoanId} → RENEWED; new loan #${result.newLoan.loanId}`);
      this.log(
        `Disbursed ${money(result.disbursement.amount)} from ${result.disbursement.accountName}`
      );
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
