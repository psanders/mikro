/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args } from "@oclif/core";
import moment from "moment";
import cliui from "cliui";
import { BaseCommand } from "../../../BaseCommand.js";
import errorHandler from "../../../errorHandler.js";
import { promptCustomerSelectIfMissing } from "../../../lib/prompts.js";
import { cliuiCells, cliuiTableWidth, computeColumnWidths } from "../../../lib/cliTableLayout.js";

export default class TagsList extends BaseCommand<typeof TagsList> {
  static override readonly description = "list every tag (AUTO + MANUAL) on a customer";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> <customerId>"
  ];
  static override readonly args = {
    customerId: Args.string({ description: "The Customer ID", required: false })
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(TagsList);
    const client = this.createClient();

    const customerId = await promptCustomerSelectIfMissing(
      client,
      args.customerId,
      "Customer",
      "customerId"
    );

    try {
      const tags = await client.listCustomerTags.query({ customerId });

      if (tags.length === 0) {
        this.log("No tags set on this customer.");
        return;
      }

      const headers = ["TAG", "SOURCE", "SET AT"];
      const rows = tags.map((t) => [
        t.tag,
        t.source,
        moment(t.setAt).format("YYYY-MM-DD HH:mm:ss")
      ]);
      const widths = computeColumnWidths({ headers, rows, minWidths: [], maxWidths: [] });
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
