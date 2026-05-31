/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { confirm } from "@inquirer/prompts";
import { formatMoney, computePaymentSplit } from "@mikro/common";
import { Args, Flags } from "@oclif/core";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";
import { parseSingleDate, validateDate } from "../../BaseCommand.js";
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
    }),
    "paid-at": Flags.string({
      description: "Payment date YYYY-MM-DD (defaults to today; use when registering a late entry)",
      required: false
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

    if (flags["paid-at"]) {
      validateDate(flags["paid-at"]);
    }
    const paidAt = flags["paid-at"] ? parseSingleDate(flags["paid-at"]) : undefined;

    const loan = await client.getLoanByLoanId.query({ loanId });
    if (!loan) {
      this.error(`Loan not found: ${loanId}`);
      return;
    }
    const expected = Number(loan.paymentAmount);

    if (paidAt) {
      this.log(`Fecha de pago: ${paidAt.toISOString().slice(0, 10)}`);
    }
    const preview = await client.previewLateFee.query({
      loanId,
      ...(paidAt ? { asOf: paidAt } : {})
    });

    const split = computePaymentSplit({
      amount,
      expectedCuota: preview.cuota,
      accruedMora: preview.accruedMora,
      lateFeeOverride: flags["late-fee-override"],
      statusOverride:
        flags.status === "COMPLETED" || flags.status === "PARTIAL" ? flags.status : undefined
    });

    this.log("");
    this.log(`Cuota: ${formatMoney(preview.cuota)}`);
    if (preview.accruedMora > 0) {
      this.log(`Mora neta: ${formatMoney(preview.accruedMora)} (${preview.daysLate} días)`);
    }

    if (amount < preview.suggestedTotal) {
      this.log(`Pago recibido ${formatMoney(amount)} — distribuido así:`);
      if (split.lateFeePortion > 0) {
        this.log(`  → Mora:    ${formatMoney(split.lateFeePortion)}`);
      }
      this.log(
        `  → Cuota:   ${formatMoney(split.installmentPortion)}  (${split.installmentStatus === "PARTIAL" ? "parcial" : "completa"})`
      );
    } else {
      this.log(`Total: ${formatMoney(amount)}`);
    }
    this.log("");

    let status: "COMPLETED" | "PARTIAL" | undefined =
      flags.status === "COMPLETED" || flags.status === "PARTIAL" ? flags.status : undefined;

    if (!status && split.installmentStatus === "PARTIAL" && process.stdout.isTTY) {
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

    const moraPart = split.lateFeePortion > 0 ? `${formatMoney(split.lateFeePortion)} mora + ` : "";
    const cuotaLabel = split.installmentStatus === "PARTIAL" ? "cuota parcial" : "cuota";
    const confirmMsg = `Registrar ${moraPart}${formatMoney(split.installmentPortion)} ${cuotaLabel} con ${formatMoney(amount)} recibidos?`;
    const ready = await this.confirmOrAbort(confirmMsg);
    if (!ready) return;

    const lateFeeOverride = flags["late-fee-override"];

    try {
      const result = await client.createPayment.mutate({
        loanId,
        amount,
        method,
        collectedById,
        notes,
        ...(paidAt ? { paidAt } : {}),
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
