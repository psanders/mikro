/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { formatMoney, type LoanPricing } from "@mikro/common";
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

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

function formatPricing(pricing: LoanPricing): string {
  return `Pricing (server config): ${formatPercent(pricing.referenceRate)} at ${pricing.referenceWeeks} weeks, ±${formatPercent(pricing.adjustmentPerWeek)} per week, min ${formatPercent(pricing.minRate)}, max ${formatPercent(pricing.maxRate)}`;
}

export default class Calculate extends BaseCommand<typeof Calculate> {
  static override readonly description = "calculate loan options with the server's pricing";
  static override readonly examples = ["<%= config.bin %> <%= command.id %>"];

  public async run(): Promise<void> {
    const client = this.createClient();

    this.log("This utility shows loan options priced from the server's loanPricing config.");
    this.log("Press ^C at any time to quit.");

    try {
      const principalInput = await input({
        message: "Principal amount (RD$)",
        required: true
      });
      const principal = parsePositiveNumber(principalInput, "Principal");

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
        formatPercent(option.interestRate),
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
      // An older server returns no pricing; skip the line rather than guess it.
      const pricing = (result as { pricing?: LoanPricing }).pricing;
      if (pricing) {
        this.log(formatPricing(pricing));
        this.log("");
      }
      this.log(ui.toString());
      this.log("");
      this.log(">>> marks the base duration option.");
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
