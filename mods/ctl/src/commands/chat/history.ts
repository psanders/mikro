/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import cliui from "cliui";
import moment from "moment";
import { ListCommand } from "../../ListCommand.js";
import errorHandler from "../../errorHandler.js";

export default class History extends ListCommand<typeof History> {
  static override readonly description = "retrieve chat history for a member or user";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> --member-id <member-id>",
    "<%= config.bin %> <%= command.id %> --user-id <user-id>"
  ];
  static override readonly flags = {
    "member-id": Flags.string({
      description: "The Member ID to get chat history for",
      exclusive: ["user-id"]
    }),
    "user-id": Flags.string({
      description: "The User ID to get chat history for",
      exclusive: ["member-id"]
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(History);
    const client = this.createClient();

    if (!flags["member-id"] && !flags["user-id"]) {
      this.error("Either --member-id or --user-id is required");
      return;
    }

    try {
      const messages = await client.getChatHistory.query({
        memberId: flags["member-id"],
        userId: flags["user-id"],
        limit: flags["page-size"]
      });

      const ui = cliui({ width: 170 });

      ui.div(
        { text: "TIMESTAMP", padding: [0, 0, 0, 0], width: 22 },
        { text: "ROLE", padding: [0, 0, 0, 0], width: 8 },
        { text: "CONTENT", padding: [0, 0, 0, 0] }
      );

      ui.div({ text: "-".repeat(170), padding: [0, 0, 0, 0] });

      messages.forEach((message) => {
        // Truncate content if too long for display
        const maxContentLength = 120;
        const content =
          message.content.length > maxContentLength
            ? message.content.substring(0, maxContentLength) + "..."
            : message.content;

        ui.div(
          {
            text: moment(message.createdAt).format("YYYY-MM-DD HH:mm:ss"),
            padding: [0, 0, 0, 0],
            width: 22
          },
          { text: message.role, padding: [0, 0, 0, 0], width: 8 },
          { text: content.replace(/\n/g, " "), padding: [0, 0, 0, 0] }
        );
      });

      this.log(ui.toString());
      this.log(`\nTotal messages: ${messages.length}`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
