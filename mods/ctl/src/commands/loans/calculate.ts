/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { formatMoney } from "@mikro/common";
import { input, select } from "@inquirer/prompts";
import cliui from "cliui";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import { cliuiCells, cliuiTableWidth, computeColumnWidths } from "../../lib/cliTableLayout.js";

type PaymentFrequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
type LoanOption = {
  duration: number;
  paymentFrequency: PaymentFrequency;
  interestRate: number;
  totalInterest: number;
  totalRepay: number;
  paymentPerPeriod: number;
  isBase: boolean;
};

function parsePositiveNumber(value: string, fieldName: string): number {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive number`);
  }
  return parsed;
}

function normalizeInterestRate(value: number): number {
  if (value > 1) {
    return value / 100;
  }
  return value;
}

export default class Calculate extends BaseCommand<typeof Calculate> {
  static override readonly description = "calculate loan options interactively";
  static override readonly examples = ["<%= config.bin %> <%= command.id %>"];

  public async run(): Promise<void> {
    const client = this.createClient();

    this.log("This utility will help you calculate loan options.");
    this.log("Press ^C at any time to quit.");

    try {
      const principalInput = await input({
        message: "Principal amount (RD$)",
        required: true
      });
      const principal = parsePositiveNumber(principalInput, "Principal");

      const interestInput = await input({
        message: "Total interest rate (use 30 or 0.30 for 30%)",
        required: true,
        default: "0.30"
      });
      const interestRate = normalizeInterestRate(
        parsePositiveNumber(interestInput, "Total interest rate")
      );

      const paymentFrequency = await select<PaymentFrequency>({
        message: "Payment frequency",
        default: "WEEKLY",
        choices: [
          { name: "Daily (Diario)", value: "DAILY" },
          { name: "Weekly (Semanal)", value: "WEEKLY" },
          { name: "Biweekly (Quincenal)", value: "BIWEEKLY" },
          { name: "Monthly (Mensual)", value: "MONTHLY" }
        ]
      });

      const baseDurationInput = await input({
        message: `Base duration in ${paymentFrequency.toLowerCase()} periods`,
        required: true
      });
      const baseDuration = Math.floor(parsePositiveNumber(baseDurationInput, "Base duration"));

      const result = await client.calculateLoan.query({
        principal,
        interestRate,
        paymentFrequency,
        baseDuration
      });

      const headers = [
        "OPT",
        "DURATION",
        "FREQ",
        "INTEREST",
        "INT. AMOUNT",
        "TOTAL",
        "PAYMENT/PERIOD"
      ];
      const rows = result.options.map((option: LoanOption) => [
        option.isBase ? ">>> " : "",
        String(option.duration),
        option.paymentFrequency,
        `${(option.interestRate * 100).toFixed(2)}%`,
        `RD$ ${formatMoney(option.totalInterest)}`,
        `RD$ ${formatMoney(option.totalRepay)}`,
        `RD$ ${formatMoney(option.paymentPerPeriod)}`
      ]);
      const widths = computeColumnWidths({ headers, rows });
      const ui = cliui({ width: cliuiTableWidth(widths) });
      ui.div(...cliuiCells(headers, widths));
      for (const row of rows) {
        ui.div(...cliuiCells(row, widths));
      }

      this.log("");
      this.log(ui.toString());
      this.log("");
      this.log(">>> marks the base duration option.");
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
