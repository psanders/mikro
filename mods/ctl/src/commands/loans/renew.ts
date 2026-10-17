/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { MutationCommand } from "../../MutationCommand.js";
import { validateDate } from "../../BaseCommand.js";
import { localDateString, parseDateOnly } from "../../lib/dates.js";
import errorHandler from "../../errorHandler.js";
import {
  promptLoanSelectIfMissing,
  promptNumberIfMissing,
  promptSelectIfMissing,
  promptTextIfMissing
} from "../../lib/prompts.js";

const money = (n: number) =>
  `RD$ ${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default class Renew extends MutationCommand<typeof Renew> {
  static override readonly description =
    "renew an active loan mid-term: close it as RENEWED, open the new loan, post the net disbursement and (optionally) generate the contract";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> 10034 --principal 10000 --term-length 10 --payment-amount 1300 --payment-frequency WEEKLY"
  ];
  static override readonly args = {
    loanId: Args.string({ description: "Loan number to renew (e.g. 10034)", required: false })
  };
  static override readonly flags = {
    payoff: Flags.string({
      description: "Amount still owed on the old loan (defaults to the quoted balance + mora)",
      required: false
    }),
    principal: Flags.integer({ description: "New loan principal", required: false }),
    "term-length": Flags.integer({ description: "New loan term (periods)", required: false }),
    "payment-amount": Flags.integer({ description: "New loan cuota", required: false }),
    "payment-frequency": Flags.string({
      description: "New loan payment frequency",
      options: ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"],
      required: false
    }),
    "starting-date": Flags.string({
      description: "Starting date for the new loan (YYYY-MM-DD). Defaults to today.",
      required: false
    }),
    account: Flags.string({
      description: "Disbursement account ID (defaults to accounting.disbursementAccountId)",
      required: false
    }),
    "no-contract": Flags.boolean({
      description: "Skip generating the new contract",
      default: false
    }),
    output: Flags.string({
      description: "Directory to write the contract PDF to",
      default: "./output"
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Renew);
    const client = this.createClient();

    this.log("This utility will renew an active loan.");
    this.log("Press ^C at any time to quit.");

    const loanId = await promptLoanSelectIfMissing(client, args.loanId, "Loan to renew", "loanId");

    try {
      const quote = await client.getRenewalQuote.query({ loanId });
      this.log(`Customer: ${quote.customer.name}`);
      this.log(
        `Current: ${money(quote.currentTerms.principal)} · ${quote.currentTerms.termLength} × ${money(quote.currentTerms.paymentAmount)} ${quote.currentTerms.paymentFrequency} · ${quote.cuotasCovered} cuotas covered`
      );
      this.log(
        `Owed: ${money(quote.remainingBalance)} balance + ${money(quote.moraAccrued)} mora = ${money(quote.suggestedPayoff)}`
      );

      const payoffStr = await promptTextIfMissing(flags.payoff, "Payoff amount", "payoff", {
        default: String(quote.suggestedPayoff)
      });
      const payoffAmount = Number(payoffStr);
      if (!Number.isFinite(payoffAmount) || payoffAmount < 0) {
        this.error(`Invalid payoff: ${payoffStr}`);
      }
      const principal = await promptNumberIfMissing(flags.principal, "New principal", "principal");
      const paymentFrequency = await promptSelectIfMissing(
        flags["payment-frequency"] as "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | undefined,
        "Payment Frequency",
        "payment-frequency",
        [
          { name: "Daily (Diario)", value: "DAILY" as const },
          { name: "Weekly (Semanal)", value: "WEEKLY" as const },
          { name: "Biweekly (Quincenal)", value: "BIWEEKLY" as const },
          { name: "Monthly (Mensual)", value: "MONTHLY" as const }
        ]
      );
      const termLength = await promptNumberIfMissing(
        flags["term-length"],
        "Term Length (number of periods)",
        "term-length"
      );
      const paymentAmount = await promptNumberIfMissing(
        flags["payment-amount"],
        "Payment Amount (per period)",
        "payment-amount"
      );
      const startingDateStr = await promptTextIfMissing(
        flags["starting-date"],
        "Starting date (YYYY-MM-DD)",
        "starting-date",
        { default: localDateString() }
      );
      validateDate(startingDateStr);

      const net = principal - payoffAmount;
      if (net <= 0) {
        this.error("The payoff must be less than the new principal.");
      }
      this.log(`Net to disburse: ${money(net)}`);

      const ready = await this.confirmOrAbort("Ready to renew this loan?");
      if (!ready) return;

      const result = await client.renewLoan.mutate({
        loanId,
        payoffAmount,
        principal,
        termLength,
        paymentAmount,
        paymentFrequency,
        startingDate: parseDateOnly(startingDateStr),
        generateContract: !flags["no-contract"],
        ...(flags.account && { disbursementAccountId: flags.account })
      });

      this.log("Done!");
      this.log(`Loan #${result.oldLoanId} → RENEWED; new loan #${result.newLoan.loanId}`);
      this.log(
        `Disbursed ${money(result.disbursement.amount)} from ${result.disbursement.accountName}`
      );
      if (result.contract) {
        const outputDir = resolve(flags.output);
        if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
        const pdfPath = join(outputDir, result.contract.filename);
        writeFileSync(pdfPath, Buffer.from(result.contract.dataBase64, "base64"));
        this.log(`Contract saved: ${pdfPath}`);
      }
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
