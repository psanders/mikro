/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import cliui from "cliui";
import { BaseCommand } from "../../../BaseCommand.js";
import errorHandler from "../../../errorHandler.js";
import { cliuiCells, cliuiTableWidth, computeColumnWidths } from "../../../lib/cliTableLayout.js";

export default class List extends BaseCommand<typeof List> {
  static override readonly description = "list accounting accounts and their current balances";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --include-inactive"
  ];
  static override readonly flags = {
    "include-inactive": Flags.boolean({
      description: "include inactive accounts",
      default: false
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(List);
    const client = this.createClient();

    try {
      const accounts = await client.accounting.listAccounts.query({
        includeInactive: flags["include-inactive"]
      });

      const headers = ["ID", "NAME", "KIND", "CURRENCY", "BALANCE", "ACTIVE"];
      const rows = accounts.map((a) => [
        a.id,
        a.name,
        a.kind,
        a.currency,
        a.currentBalance.toFixed(2),
        a.isActive ? "Yes" : "No"
      ]);
      const widths = computeColumnWidths({
        headers,
        rows,
        minWidths: [undefined, undefined, undefined, undefined, undefined, 8]
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
