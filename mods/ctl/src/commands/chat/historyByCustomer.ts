/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args } from "@oclif/core";
import cliui from "cliui";
import moment from "moment";
import { ListCommand } from "../../ListCommand.js";
import errorHandler from "../../errorHandler.js";
import { cliuiCells, cliuiTableWidth, computeColumnWidths } from "../../lib/cliTableLayout.js";
import { promptCustomerSelectIfMissing } from "../../lib/prompts.js";

export default class HistoryByCustomer extends ListCommand<typeof HistoryByCustomer> {
  static override readonly description = "retrieve chat history for a customer";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <customerId>",
    "<%= config.bin %> <%= command.id %>"
  ];
  static override readonly args = {
    customerId: Args.string({
      description: "The Customer ID to get chat history for",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(HistoryByCustomer);
    const client = this.createClient();

    const customerId = await promptCustomerSelectIfMissing(
      client,
      args.customerId,
      "Customer",
      "customerId"
    );

    try {
      const messages = await client.getChatHistory.query({
        customerId,
        limit: flags["page-size"]
      });

      this.renderMessages(messages);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }

  private renderMessages(
    messages: Array<{ createdAt: string | Date; role: string; content: string }>
  ): void {
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
  }
}
