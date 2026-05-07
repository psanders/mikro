/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { formatMoney } from "@mikro/common";
import { Flags } from "@oclif/core";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";
import cliui from "cliui";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import { cliuiCells, cliuiTableWidth, computeColumnWidths } from "../../lib/cliTableLayout.js";

function firstDayOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function lastMonth(d: Date): { start: Date; end: Date } {
  const end = new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59, 999);
  const start = new Date(end.getFullYear(), end.getMonth(), 1, 0, 0, 0, 0);
  return { start, end };
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const ACCOUNT_KIND_LABELS: Record<string, string> = {
  BANK: "Banco",
  CASH: "Efectivo",
  CREDIT_CARD: "Tarjeta",
  OTHER: "Otro"
};

const TXN_TYPE_LABELS: Record<string, string> = {
  DEPOSIT: "Depósito",
  WITHDRAWAL: "Retiro",
  EXPENSE: "Gasto",
  INCOME: "Ingreso",
  TRANSFER: "Transferencia"
};

export default class Accounting extends BaseCommand<typeof Accounting> {
  static override readonly description =
    "accounting snapshot: account balances and month-to-date transaction ledger (PNG or table)";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --last-month",
    "<%= config.bin %> <%= command.id %> --format table",
    "<%= config.bin %> <%= command.id %> --start-date 2026-04-01 --end-date 2026-04-30",
    "<%= config.bin %> <%= command.id %> --output reporte-contable.png"
  ];

  static override readonly flags = {
    "start-date": Flags.string({
      description: "Start of report period (default: first day of current month, MTD)"
    }),
    "end-date": Flags.string({
      description: "End of report period (default: today)"
    }),
    "last-month": Flags.boolean({
      description: "Use previous full month as the period",
      default: false
    }),
    format: Flags.string({
      description: "Output format",
      options: ["png", "table"],
      default: "png"
    }),
    output: Flags.string({
      char: "o",
      description: "Output file path for PNG",
      default: ""
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Accounting);

    let startDate: Date;
    let endDate: Date;

    if (flags["last-month"]) {
      const lm = lastMonth(new Date());
      startDate = lm.start;
      endDate = lm.end;
    } else {
      endDate = flags["end-date"] ? new Date(flags["end-date"]) : new Date();
      startDate = flags["start-date"] ? new Date(flags["start-date"]) : firstDayOfMonth(endDate);
    }

    try {
      const client = this.createClient();
      this.log("Generating accounting report...");
      this.log(`  Period: ${toISODate(startDate)} to ${toISODate(endDate)}`);

      const result = await client.accounting.generateAccountingReport.mutate({
        startDate: toISODate(startDate),
        endDate: toISODate(endDate)
      });

      if (flags.format === "table") {
        this.renderTable(result.data);
      } else {
        const outputPath = flags.output
          ? resolve(flags.output)
          : resolve(
              `./mikro-accounting-report-${toISODate(startDate)}-to-${toISODate(endDate)}.png`
            );

        const dir = resolve(outputPath, "..");
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }

        writeFileSync(outputPath, Buffer.from(result.image, "base64"));
        this.log(`\nReport saved: ${outputPath}`);
      }
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }

  private renderTable(data: {
    period: { startDate: string; endDate: string };
    accounts: Array<{ name: string; kind: string; currency: string; currentBalance: number }>;
    transactions: Array<{
      occurredAt: string;
      type: string;
      accountName: string;
      categoryName: string | null;
      vendor: string | null;
      description: string | null;
      amount: number;
    }>;
    totals: {
      totalIncome: number;
      totalExpenses: number;
      netFlow: number;
      combinedBalance: number;
    };
  }): void {
    this.log("");
    this.log(`=== Balance de cuentas ===`);
    this.log("");

    const balanceHeaders = ["CUENTA", "TIPO", "BALANCE"];
    const balanceRows = data.accounts.map((a) => [
      a.name,
      ACCOUNT_KIND_LABELS[a.kind] ?? a.kind,
      formatMoney(a.currentBalance)
    ]);
    balanceRows.push(["---", "---", "---"]);
    balanceRows.push(["TOTAL", "", formatMoney(data.totals.combinedBalance)]);

    const bWidths = computeColumnWidths({ headers: balanceHeaders, rows: balanceRows });
    const bUi = cliui({ width: cliuiTableWidth(bWidths) });
    bUi.div(...cliuiCells(balanceHeaders, bWidths));
    for (const row of balanceRows) {
      bUi.div(...cliuiCells(row, bWidths));
    }
    this.log(bUi.toString());

    this.log("");
    this.log(`=== Resumen del periodo ===`);
    this.log("");
    this.log(`  Ingresos:      ${formatMoney(data.totals.totalIncome)} DOP`);
    this.log(`  Gastos:        ${formatMoney(data.totals.totalExpenses)} DOP`);
    this.log(`  Flujo neto:    ${formatMoney(data.totals.netFlow)} DOP`);
    this.log("");

    this.log(`=== Transacciones (${data.transactions.length}) ===`);
    this.log("");

    if (data.transactions.length === 0) {
      this.log("  No hay transacciones en este periodo.");
      return;
    }

    const txnHeaders = ["FECHA", "TIPO", "CUENTA", "CATEGORÍA", "DESCRIPCIÓN", "MONTO"];
    const txnRows = data.transactions.map((t) => {
      const label = t.vendor ?? t.description ?? "";
      return [
        t.occurredAt.slice(0, 10),
        TXN_TYPE_LABELS[t.type] ?? t.type,
        t.accountName,
        t.categoryName ?? "-",
        label,
        formatMoney(t.amount)
      ];
    });

    const maxWidths: Array<number | undefined> = [
      undefined,
      undefined,
      undefined,
      undefined,
      44,
      undefined
    ];
    const tWidths = computeColumnWidths({ headers: txnHeaders, rows: txnRows, maxWidths });
    const tUi = cliui({ width: cliuiTableWidth(tWidths) });
    tUi.div(...cliuiCells(txnHeaders, tWidths));
    for (const row of txnRows) {
      tUi.div(...cliuiCells(row, tWidths));
    }
    this.log(tUi.toString());
  }
}
