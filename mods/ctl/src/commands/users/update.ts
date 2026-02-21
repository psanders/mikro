/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { confirm, input, password, select } from "@inquirer/prompts";
import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import { promptUserSelectIfMissing } from "../../lib/prompts.js";

export default class Update extends BaseCommand<typeof Update> {
  static override readonly description = "modify a user's information";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <userId>",
    "<%= config.bin %> <%= command.id %> <userId> --password 'newSecret'"
  ];
  static override readonly args = {
    userId: Args.string({
      description: "The User ID to update",
      required: false
    })
  };
  static override readonly flags = {
    password: Flags.string({
      description: "New password (omit to keep current or be prompted)",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Update);
    const client = this.createClient();

    const userId = await promptUserSelectIfMissing(client, args.userId, "User", "userId");

    try {
      const userFromDB = await client.protected.getUser.query({ id: userId });

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

      let newPassword: string | undefined = flags.password ?? undefined;
      if (newPassword === undefined && process.stdout.isTTY) {
        const entered = await password({
          message: "New password (leave blank to keep current)",
          mask: true
        });
        if (entered.length > 0) {
          newPassword = entered;
        }
      }

      const ready = await confirm({ message: "Ready to update user?" });

      if (!ready) {
        this.log("Aborted!");
        return;
      }

      await client.protected.updateUser.mutate({
        id: userId,
        name: answers.name,
        phone: answers.phone,
        enabled: answers.enabled,
        role: answers.role,
        ...(newPassword !== undefined && { password: newPassword })
      });

      this.log("Done!");
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
