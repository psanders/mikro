/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { formatMoney } from "@mikro/common";
import { Flags } from "@oclif/core";
import cliui from "cliui";
import moment from "moment";
import { ListCommand } from "../../../ListCommand.js";
import { validateDate } from "../../../BaseCommand.js";
import errorHandler from "../../../errorHandler.js";
import { cliuiCells, cliuiTableWidth, computeColumnWidths } from "../../../lib/cliTableLayout.js";

export default class List extends ListCommand<typeof List> {
  static override readonly description = "list accounting transactions within a date range";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> --start-date 2026-04-01 --end-date 2026-04-30",
    "<%= config.bin %> <%= command.id %> --start-date 2026-04-01 --end-date 2026-04-30 --type EXPENSE"
  ];
  static override readonly flags = {
    "start-date": Flags.string({ description: "Start date (YYYY-MM-DD)", required: true }),
    "end-date": Flags.string({ description: "End date (YYYY-MM-DD)", required: true }),
    "account-id": Flags.string({
      description: "Filter by account (source or destination for transfers)",
      required: false
    }),
    "category-id": Flags.string({ description: "Filter by category", required: false }),
    type: Flags.string({
      description: "Filter by type",
      options: ["DEPOSIT", "WITHDRAWAL", "EXPENSE", "INCOME", "TRANSFER"],
      required: false
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(List);
    const client = this.createClient();

    validateDate(flags["start-date"]!);
    validateDate(flags["end-date"]!);

    try {
      const txns = await client.accounting.listTransactions.query({
        startDate: new Date(flags["start-date"]!),
        endDate: new Date(flags["end-date"]!),
        ...(flags["account-id"] ? { accountId: flags["account-id"] } : {}),
        ...(flags["category-id"] ? { categoryId: flags["category-id"] } : {}),
        ...(flags.type
          ? {
              type: flags.type as "DEPOSIT" | "WITHDRAWAL" | "EXPENSE" | "INCOME" | "TRANSFER"
            }
          : {}),
        includeReversed: flags["include-hidden"],
        limit: flags["page-size"]
      });

      const headers = [
        "ID",
        "DATE",
        "TYPE",
        "STATUS",
        "ACCOUNT",
        "TO ACCOUNT",
        "CATEGORY",
        "AMOUNT",
        "VENDOR/DESCRIPTION",
        "ATT"
      ];
      const rows = txns.map((t) => {
        const label = t.vendor ?? t.description ?? "";
        return [
          t.id,
          moment(t.occurredAt).format("YYYY-MM-DD"),
          t.type,
          t.status,
          t.account.name,
          t.toAccount?.name ?? "-",
          t.category?.name ?? "-",
          formatMoney(t.amount),
          label,
          String(t.attachmentCount)
        ];
      });
      // Cap wide text; keep ATT at least header width ("ATT") and at most old fixed layout width.
      const colCount = headers.length;
      const minWidths: Array<number | undefined> = Array.from(
        { length: colCount },
        () => undefined
      );
      const maxWidths: Array<number | undefined> = Array.from(
        { length: colCount },
        () => undefined
      );
      minWidths[9] = 3;
      maxWidths[8] = 44;
      maxWidths[9] = 5;
      const widths = computeColumnWidths({
        headers,
        rows,
        minWidths,
        maxWidths
      });
      const ui = cliui({ width: cliuiTableWidth(widths) });
      ui.div(...cliuiCells(headers, widths));
      for (const row of rows) {
        ui.div(...cliuiCells(row, widths));
      }

      this.log(ui.toString());
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
