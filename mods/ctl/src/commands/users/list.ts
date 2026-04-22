/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import cliui from "cliui";
import { ListCommand } from "../../ListCommand.js";
import errorHandler from "../../errorHandler.js";
import { cliuiCells, cliuiTableWidth, computeColumnWidths } from "../../lib/cliTableLayout.js";

export default class List extends ListCommand<typeof List> {
  static override readonly description = "display all users";
  static override readonly examples = ["<%= config.bin %> <%= command.id %>"];
  static override readonly flags = {
    "include-disabled": Flags.boolean({
      char: "a",
      description: "include disabled users",
      default: false
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(List);
    const client = this.createClient();

    try {
      const users = await client.listUsers.query({
        showDisabled: flags["include-disabled"],
        limit: flags["page-size"]
      });

      const headers = ["ID", "NAME", "PHONE", "ENABLED"];
      const rows = users.map((user) => [
        user.id,
        user.name,
        user.phone || "N/A",
        user.enabled ? "Yes" : "No"
      ]);
      const widths = computeColumnWidths({
        headers,
        rows,
        minWidths: [undefined, undefined, undefined, 10]
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
