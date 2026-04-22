/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import cliui from "cliui";
import { BaseCommand } from "../../../BaseCommand.js";
import errorHandler from "../../../errorHandler.js";
import { cliuiCells, cliuiTableWidth, computeColumnWidths } from "../../../lib/cliTableLayout.js";

export default class List extends BaseCommand<typeof List> {
  static override readonly description = "list accounting categories";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --kind EXPENSE"
  ];
  static override readonly flags = {
    kind: Flags.string({
      description: "Filter by kind",
      options: ["EXPENSE", "INCOME"],
      required: false
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(List);
    const client = this.createClient();

    try {
      const categories = await client.accounting.listCategories.query({
        ...(flags.kind ? { kind: flags.kind as "EXPENSE" | "INCOME" } : {})
      });

      const headers = ["ID", "NAME", "KIND"];
      const rows = categories.map((c) => [c.id, c.name, c.kind]);
      const widths = computeColumnWidths({ headers, rows });
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
