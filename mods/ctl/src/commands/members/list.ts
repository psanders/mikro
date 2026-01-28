/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import cliui from "cliui";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

export default class List extends BaseCommand<typeof List> {
  static override readonly description = "display all members";
  static override readonly examples = ["<%= config.bin %> <%= command.id %>"];
  static override readonly flags = {
    "include-inactive": Flags.boolean({
      char: "a",
      description: "include inactive members",
      default: false
    }),
    "page-size": Flags.integer({
      char: "s",
      description: "the number of items to show",
      default: 100
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(List);
    const client = this.createClient();

    try {
      const members = await client.listMembers.query({
        showInactive: flags["include-inactive"],
        limit: flags["page-size"]
      });

      const ui = cliui({ width: 180 });

      ui.div(
        { text: "ID", padding: [0, 0, 0, 0], width: 38 },
        { text: "NAME", padding: [0, 0, 0, 0], width: 35 },
        { text: "PHONE", padding: [0, 0, 0, 0], width: 18 },
        { text: "ACTIVE", padding: [0, 0, 0, 0], width: 10 }
      );

      members.forEach((member) => {
        ui.div(
          { text: member.id, padding: [0, 0, 0, 0], width: 38 },
          { text: member.name, padding: [0, 0, 0, 0], width: 35 },
          { text: member.phone, padding: [0, 0, 0, 0], width: 18 },
          { text: member.isActive ? "Yes" : "No", padding: [0, 0, 0, 0], width: 10 }
        );
      });

      this.log(ui.toString());
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
