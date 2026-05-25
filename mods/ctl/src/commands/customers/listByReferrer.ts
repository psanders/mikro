/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args } from "@oclif/core";
import cliui from "cliui";
import { ListCommand } from "../../ListCommand.js";
import errorHandler from "../../errorHandler.js";
import { cliuiCells, cliuiTableWidth, computeColumnWidths } from "../../lib/cliTableLayout.js";
import { promptUserSelectIfMissing } from "../../lib/prompts.js";

export default class ListByReferrer extends ListCommand<typeof ListByReferrer> {
  static override readonly description = "display customers by referrer";
  static override readonly examples = ["<%= config.bin %> <%= command.id %> <referrerId>"];
  static override readonly args = {
    referrerId: Args.string({
      description: "The Referrer ID to filter by",
      required: false
    })
  };
  public async run(): Promise<void> {
    const { args, flags } = await this.parse(ListByReferrer);
    const client = this.createClient();

    const referrerId = await promptUserSelectIfMissing(
      client,
      args.referrerId,
      "Referrer",
      "referrerId",
      { role: "REFERRER" }
    );

    try {
      const customers = await client.listCustomersByReferrer.query({
        referredById: referrerId,
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
