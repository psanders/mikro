/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args } from "@oclif/core";
import cliui from "cliui";
import { ListCommand } from "../../ListCommand.js";
import errorHandler from "../../errorHandler.js";
import { cliuiCells, cliuiTableWidth, computeColumnWidths } from "../../lib/cliTableLayout.js";
import { promptCustomerSelectIfMissing } from "../../lib/prompts.js";

export default class DocumentsList extends ListCommand<typeof DocumentsList> {
  static override readonly description =
    "display a customer's stored documents (signed contracts, ID images)";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <customerId>",
    "<%= config.bin %> <%= command.id %>"
  ];
  static override readonly args = {
    customerId: Args.string({
      description: "The Customer ID to list documents for",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(DocumentsList);
    const client = this.createClient();

    const customerId = await promptCustomerSelectIfMissing(
      client,
      args.customerId,
      "Customer",
      "customerId"
    );

    try {
      const documents = await client.listCustomerDocuments.query({ customerId });

      if (documents.length === 0) {
        this.log("No documents stored for this customer.");
        return;
      }

      const headers = ["TYPE", "SOURCE", "FILENAME", "UPLOADED BY", "CREATED AT"];
      const rows = documents.map((doc) => [
        doc.type,
        doc.source === "MIGRATED_FROM_APPLICATION" ? "MIGRATED" : "DIRECT",
        doc.filename,
        doc.uploadedById ?? "—",
        new Date(doc.createdAt).toISOString()
      ]);
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
