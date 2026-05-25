/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import cliui from "cliui";
import { ListCommand } from "../../ListCommand.js";
import errorHandler from "../../errorHandler.js";
import { cliuiCells, cliuiTableWidth, computeColumnWidths } from "../../lib/cliTableLayout.js";

export default class List extends ListCommand<typeof List> {
  static override readonly description = "display all customers";
  static override readonly examples = ["<%= config.bin %> <%= command.id %>"];

  public async run(): Promise<void> {
    const { flags } = await this.parse(List);
    const client = this.createClient();

    try {
      const customers = await client.listCustomers.query({
        showInactive: flags["include-hidden"],
        limit: flags["page-size"]
      });

      const headers = ["ID", "NAME", "NICKNAME", "PHONE", "ACTIVE"];
      const rows = customers.map((customer) => {
        return [
          customer.id,
          customer.name,
          customer.nickname ?? "",
          customer.phone,
          customer.isActive ? "Yes" : "No"
        ];
      });
      const widths = computeColumnWidths({
        headers,
        rows,
        minWidths: [undefined, undefined, undefined, undefined, 8],
        maxWidths: [undefined, undefined, undefined, undefined, undefined]
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
