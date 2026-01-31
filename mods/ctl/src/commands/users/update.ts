/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { confirm, input, select } from "@inquirer/prompts";
import { Args } from "@oclif/core";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

export default class Update extends BaseCommand<typeof Update> {
  static override readonly description = "modify a user's information";
  static override readonly examples = ["<%= config.bin %> <%= command.id %> <userId>"];
  static override readonly args = {
    userId: Args.string({
      description: "The User ID to update",
      required: true
    })
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(Update);
    const client = this.createClient();

    try {
      const userFromDB = await client.getUser.query({ id: args.userId });

      if (!userFromDB) {
        this.error("User not found.");
        return;
      }

      this.log("This utility will help you update a User.");
      this.log("Press ^C at any time to quit.");

      const currentRole = userFromDB.roles?.[0]?.role;

      const answers = {
        name: await input({
          message: "Name",
          default: userFromDB.name,
          required: true
        }),
        phone: await input({
          message: "Phone (e.g., 18091234567)",
          default: userFromDB.phone ?? undefined,
          required: true
        }),
        enabled: await select({
          message: "Enabled Status",
          choices: [
            { name: "Enabled", value: true },
            { name: "Disabled", value: false }
          ],
          default: userFromDB.enabled
        }),
        role: await select({
          message: "Role",
          choices: [
            { name: "Admin", value: "ADMIN" as const },
            { name: "Collector", value: "COLLECTOR" as const },
            { name: "Referrer", value: "REFERRER" as const }
          ],
          default: currentRole ?? "REFERRER"
        })
      };

      const ready = await confirm({
        message: "Ready to update user?"
      });

      if (!ready) {
        this.log("Aborted!");
        return;
      }

      await client.updateUser.mutate({
        id: args.userId,
        name: answers.name,
        phone: answers.phone,
        enabled: answers.enabled,
        role: answers.role
      });

      this.log("Done!");
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
