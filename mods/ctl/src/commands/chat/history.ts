/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import cliui from "cliui";
import moment from "moment";
import { ListCommand } from "../../ListCommand.js";
import errorHandler from "../../errorHandler.js";
import { cliuiCells, cliuiTableWidth, computeColumnWidths } from "../../lib/cliTableLayout.js";

export default class History extends ListCommand<typeof History> {
  static override readonly description = "retrieve chat history for a customer or user";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> --customer-id <customer-id>",
    "<%= config.bin %> <%= command.id %> --user-id <user-id>"
  ];
  static override readonly flags = {
    "customer-id": Flags.string({
      description: "The Customer ID to get chat history for",
      exclusive: ["user-id"]
    }),
    "user-id": Flags.string({
      description: "The User ID to get chat history for",
      exclusive: ["customer-id"]
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(History);
    const client = this.createClient();

    if (!flags["customer-id"] && !flags["user-id"]) {
      this.error("Either --customer-id or --user-id is required");
      return;
    }

    try {
      const messages = await client.getChatHistory.query({
        customerId: flags["customer-id"],
        userId: flags["user-id"],
        limit: flags["page-size"]
      });

      const maxContentLength = 120;
      const headers = ["TIMESTAMP", "ROLE", "CONTENT"];
      const rows = messages.map((message) => {
        const content =
          message.content.length > maxContentLength
            ? message.content.substring(0, maxContentLength) + "..."
            : message.content;
        return [
          moment(message.createdAt).format("YYYY-MM-DD HH:mm:ss"),
          message.role,
          content.replace(/\n/g, " ")
        ];
      });
      const widths = computeColumnWidths({
        headers,
        rows,
        maxWidths: [undefined, undefined, maxContentLength + 3]
      });
      const tableW = cliuiTableWidth(widths);
      const ui = cliui({ width: tableW });
      ui.div(...cliuiCells(headers, widths));
      ui.div({ text: "-".repeat(tableW), padding: [0, 0, 0, 0], width: tableW });
      for (const row of rows) {
        ui.div(...cliuiCells(row, widths));
      }

      this.log(ui.toString());
      this.log(`\nTotal messages: ${messages.length}`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
