/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import cliui from "cliui";
import { ListCommand } from "../../ListCommand.js";
import errorHandler from "../../errorHandler.js";

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

      const ui = cliui({ width: 160 });

      ui.div(
        { text: "ID", padding: [0, 0, 0, 0], width: 38 },
        { text: "NAME", padding: [0, 0, 0, 0], width: 30 },
        { text: "PHONE", padding: [0, 0, 0, 0], width: 18 },
        { text: "ENABLED", padding: [0, 0, 0, 0], width: 10 }
      );

      users.forEach((user) => {
        ui.div(
          { text: user.id, padding: [0, 0, 0, 0], width: 38 },
          { text: user.name, padding: [0, 0, 0, 0], width: 30 },
          { text: user.phone || "N/A", padding: [0, 0, 0, 0], width: 18 },
          { text: user.enabled ? "Yes" : "No", padding: [0, 0, 0, 0], width: 10 }
        );
      });

      this.log(ui.toString());
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
