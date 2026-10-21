/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import { MutationCommand } from "../../MutationCommand.js";
import { validateDate } from "../../BaseCommand.js";
import { parseDateOnly } from "../../lib/dates.js";
import errorHandler from "../../errorHandler.js";
import { promptLoanSelectIfMissing } from "../../lib/prompts.js";

const money = (n: number) =>
  `RD$ ${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default class Renew extends MutationCommand<typeof Renew> {
  static override readonly description =
    "start renewing an active loan. Creates a DRAFT renewal (nothing is closed, created or posted yet); continue with loans:renewContract, loans:renewSign and loans:renewFinalize, or loans:renewCancel";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> 10034",
    "<%= config.bin %> <%= command.id %> 10034 --principal 12000 --term-length 12 --payment-amount 1250"
  ];
  static override readonly args = {
    loanId: Args.string({ description: "Loan number to renew (e.g. 10034)", required: false })
  };
  static override readonly flags = {
    principal: Flags.integer({
      description: "New loan principal (defaults to the old loan's)",
      required: false
    }),
    "term-length": Flags.integer({
      description: "New loan term in periods (defaults to the old loan's)",
      required: false
    }),
    "payment-amount": Flags.integer({
      description: "New loan cuota (defaults to the old loan's)",
      required: false
    }),
    "payment-frequency": Flags.string({
      description: "New loan payment frequency (defaults to the old loan's)",
      options: ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"],
      required: false
    }),
    "starting-date": Flags.string({
      description: "Starting date for the new loan (YYYY-MM-DD)",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Renew);
    const client = this.createClient();

    const loanId = await promptLoanSelectIfMissing(client, args.loanId, "Loan to renew", "loanId");
    if (flags["starting-date"]) validateDate(flags["starting-date"]);

    try {
      const terms = {
        ...(flags.principal !== undefined && { principal: flags.principal }),
        ...(flags["term-length"] !== undefined && { termLength: flags["term-length"] }),
        ...(flags["payment-amount"] !== undefined && { paymentAmount: flags["payment-amount"] }),
        ...(flags["payment-frequency"] && {
          paymentFrequency: flags["payment-frequency"] as
            "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY"
        }),
        ...(flags["starting-date"] && { startingDate: parseDateOnly(flags["starting-date"]) })
      };
      const renewal = await client.startLoanRenewal.mutate({ loanId, terms });

      const t = renewal.terms;
      this.log("Renewal started (nothing has been closed, created or posted yet).");
      this.log(`ID: \t${renewal.id}`);
      this.log(`CUSTOMER: \t${renewal.customer.name}`);
      this.log(`OLD LOAN: \t#${renewal.loan.loanId}`);
      this.log(
        `NEW TERMS: \t${money(t.principal)} · ${t.termLength} × ${money(t.paymentAmount)} ${t.paymentFrequency}`
      );
      this.log(`OWED TODAY: \t${money(renewal.quoted.owed ?? 0)} (recomputed when you finalize)`);
      this.log(`NET TO DISBURSE: \t${money(renewal.quoted.net ?? 0)}`);
      this.log("");
      this.log(`Next: mikro loans:renewContract ${renewal.id}`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
