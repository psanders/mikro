/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args } from "@oclif/core";
import cliui from "cliui";
import moment from "moment";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

export default class Get extends BaseCommand<typeof Get> {
  static override readonly description = "retrieve details of a user by ID";
  static override readonly examples = ["<%= config.bin %> <%= command.id %> <user-id>"];
  static override readonly args = {
    ref: Args.string({
      description: "The User ID to show details about",
      required: true
    })
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(Get);
    const client = this.createClient();

    try {
      const user = await client.getUser.query({ id: args.ref });

      if (!user) {
        this.error("User not found.");
        return;
      }

      const ui = cliui({ width: 200 });

      ui.div(
        "USER DETAILS\n" +
          "------------\n" +
          `ID: \t${user.id}\n` +
          `NAME: \t${user.name}\n` +
          `PHONE: \t${user.phone || "N/A"}\n` +
          `ENABLED: \t${user.enabled ? "Yes" : "No"}\n` +
          `CREATED: \t${moment(user.createdAt).format("YYYY-MM-DD HH:mm:ss")}\n` +
          `UPDATED: \t${moment(user.updatedAt).format("YYYY-MM-DD HH:mm:ss")}`
      );

      this.log(ui.toString());
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
