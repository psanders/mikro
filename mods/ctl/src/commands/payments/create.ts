/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { confirm } from "@inquirer/prompts";
import { formatMoney } from "@mikro/common";
import { Args, Flags } from "@oclif/core";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";
import {
  promptNumberIfMissing,
  promptSelectIfMissing,
  promptUserSelectIfMissing,
  promptLoanSelectIfMissing
} from "../../lib/prompts.js";

export default class Create extends MutationCommand<typeof Create> {
  static override readonly description = "create a new payment for a loan";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> 10000 --amount 500 --method CASH --collector-id abc-def"
  ];
  static override readonly args = {
    loanId: Args.string({
      description: "Loan ID (numeric, e.g., 10000, 10001)",
      required: false
    })
  };
  static override readonly flags = {
    amount: Flags.integer({
      description: "Payment Amount",
      required: false
    }),
    method: Flags.string({
      description: "Payment Method",
      options: ["CASH", "TRANSFER"],
      required: false
    }),
    "collector-id": Flags.string({
      description: "Collector ID",
      required: false
    }),
    notes: Flags.string({
      description: "Notes (optional)",
      required: false
    }),
    status: Flags.string({
      description:
        "Override status: COMPLETED or PARTIAL (otherwise auto from amount vs expected payment)",
      options: ["COMPLETED", "PARTIAL"],
      required: false
    }),
    "late-fee-override": Flags.integer({
      description:
        "Waive this many DOP of accrued mora before split (optional; mora-first allocation only)",
      required: false,
      min: 0
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Create);
    const client = this.createClient();

    this.log("This utility will help you create a Payment.");
    this.log("Press ^C at any time to quit.");

    const loanId = await promptLoanSelectIfMissing(
      client,
      args.loanId,
      "Loan ID (numeric, e.g., 10000, 10001)",
      "loanId"
    );
    const amount = await promptNumberIfMissing(flags.amount, "Amount", "amount");
    const method = await promptSelectIfMissing(
      flags.method as "CASH" | "TRANSFER" | undefined,
      "Payment Method",
      "method",
      [
        { name: "Cash", value: "CASH" as const },
        { name: "Transfer", value: "TRANSFER" as const }
      ],
      { default: "CASH" as const }
    );
    const collectedById = await promptUserSelectIfMissing(
      client,
      flags["collector-id"],
      "Collector",
      "collector-id",
      { role: "COLLECTOR" }
    );
    const notes = flags.notes || undefined;

    const loan = await client.getLoanByLoanId.query({ loanId });
    if (!loan) {
      this.error(`Loan not found: ${loanId}`);
      return;
    }
    const expected = Number(loan.paymentAmount);

    const preview = await client.previewLateFee.query({ loanId });
    this.log("");
    this.log(`Cuota: ${formatMoney(preview.cuota)}`);
    this.log(`Mora bruta: ${formatMoney(preview.grossMora)}`);
    this.log(`Mora ya cobrada: ${formatMoney(preview.collectedMora)}`);
    this.log(
      `Mora neta (a cobrar): ${formatMoney(preview.accruedMora)} (${preview.daysLate} días)`
    );
    this.log(`Total sugerido (cuota + mora neta): ${formatMoney(preview.suggestedTotal)}`);
    this.log("");
    let status: "COMPLETED" | "PARTIAL" | undefined =
      flags.status === "COMPLETED" || flags.status === "PARTIAL" ? flags.status : undefined;

    if (!status && amount < expected && process.stdout.isTTY) {
      const ok = await confirm({
        message: `Amount (${formatMoney(amount)}) is less than expected payment (${formatMoney(expected)}). Record as PARTIAL?`,
        default: true
      });
      if (!ok) {
        this.log("Aborted!");
        return;
      }
      status = "PARTIAL";
    }

    const ready = await this.confirmOrAbort("Ready to create payment?");
    if (!ready) return;

    const lateFeeOverride = flags["late-fee-override"];

    try {
      const result = await client.createPayment.mutate({
        loanId,
        amount,
        method,
        collectedById,
        notes,
        ...(status ? { status } : {}),
        ...(lateFeeOverride != null ? { lateFeeOverride } : {})
      });

      this.log("Done!");
      if (result.lateFee) {
        this.log(`Late fee (mora) payment ID: ${result.lateFee.id}`);
        this.log(
          `  Amount: ${formatMoney(Number(result.lateFee.amount))} — status: ${result.lateFee.status}`
        );
      }
      if (result.installment) {
        this.log(`Installment payment ID: ${result.installment.id}`);
        this.log(
          `  Amount: ${formatMoney(Number(result.installment.amount))} — status: ${result.installment.status}`
        );
      }
      if (!result.installment && !result.lateFee) {
        this.error("No payment rows were created");
      }
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
