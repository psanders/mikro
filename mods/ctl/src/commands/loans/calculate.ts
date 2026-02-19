/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { input, select } from "@inquirer/prompts";
import cliui from "cliui";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

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

      const ui = cliui({ width: 150 });
      ui.div(
        { text: "OPT", padding: [0, 0, 0, 0], width: 6 },
        { text: "DURATION", padding: [0, 0, 0, 0], width: 12 },
        { text: "FREQ", padding: [0, 0, 0, 0], width: 10 },
        { text: "INTEREST", padding: [0, 0, 0, 0], width: 12 },
        { text: "INT. AMOUNT", padding: [0, 0, 0, 0], width: 16 },
        { text: "TOTAL", padding: [0, 0, 0, 0], width: 16 },
        { text: "PAYMENT/PERIOD", padding: [0, 0, 0, 0], width: 18 }
      );

      result.options.forEach((option: LoanOption) => {
        ui.div(
          { text: option.isBase ? ">>> " : "", padding: [0, 0, 0, 0], width: 6 },
          { text: String(option.duration), padding: [0, 0, 0, 0], width: 12 },
          { text: option.paymentFrequency, padding: [0, 0, 0, 0], width: 10 },
          { text: `${(option.interestRate * 100).toFixed(2)}%`, padding: [0, 0, 0, 0], width: 12 },
          { text: `RD$ ${option.totalInterest.toFixed(2)}`, padding: [0, 0, 0, 0], width: 16 },
          { text: `RD$ ${option.totalRepay.toFixed(2)}`, padding: [0, 0, 0, 0], width: 16 },
          { text: `RD$ ${option.paymentPerPeriod}`, padding: [0, 0, 0, 0], width: 18 }
        );
      });

      this.log("");
      this.log(ui.toString());
      this.log("");
      this.log(">>> marks the base duration option.");
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
