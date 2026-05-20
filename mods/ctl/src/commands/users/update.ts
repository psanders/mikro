/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { input, password, select } from "@inquirer/prompts";
import { Args, Flags } from "@oclif/core";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";
import { promptUserSelectIfMissing } from "../../lib/prompts.js";

export default class Update extends MutationCommand<typeof Update> {
  static override readonly description = "modify a user's information";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <userId>",
    "<%= config.bin %> <%= command.id %> <userId> --password 'newSecret'",
    "<%= config.bin %> <%= command.id %> <userId> --name 'Jane' --role COLLECTOR"
  ];
  static override readonly args = {
    userId: Args.string({
      description: "The User ID to update",
      required: false
    })
  };
  static override readonly flags = {
    name: Flags.string({ description: "User name", required: false }),
    phone: Flags.string({ description: "Phone number", required: false }),
    enabled: Flags.boolean({
      description: "Whether the user is enabled",
      required: false,
      allowNo: true
    }),
    role: Flags.string({
      description: "User role",
      options: ["ADMIN", "COLLECTOR", "REFERRER"],
      required: false
    }),
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
      const userFromDB = await client.getUser.query({ id: userId });

      if (!userFromDB) {
        this.error("User not found.");
        return;
      }

      this.log("This utility will help you update a User.");
      this.log("Press ^C at any time to quit.");

      const currentRole = userFromDB.roles?.[0]?.role;

      const name =
        flags.name ??
        (process.stdout.isTTY
          ? await input({ message: "Name", default: userFromDB.name, required: true })
          : userFromDB.name);

      const phone =
        flags.phone ??
        (process.stdout.isTTY
          ? await input({
              message: "Phone (e.g., 18091234567)",
              default: userFromDB.phone ?? undefined,
              required: true
            })
          : (userFromDB.phone ?? ""));

      const enabled =
        flags.enabled !== undefined
          ? flags.enabled
          : process.stdout.isTTY
            ? await select({
                message: "Enabled Status",
                choices: [
                  { name: "Enabled", value: true },
                  { name: "Disabled", value: false }
                ],
                default: userFromDB.enabled
              })
            : userFromDB.enabled;

      const role =
        (flags.role as "ADMIN" | "COLLECTOR" | "REFERRER" | undefined) ??
        (process.stdout.isTTY
          ? await select({
              message: "Role",
              choices: [
                { name: "Admin", value: "ADMIN" as const },
                { name: "Collector", value: "COLLECTOR" as const },
                { name: "Referrer", value: "REFERRER" as const }
              ],
              default: (currentRole ?? "REFERRER") as "ADMIN" | "COLLECTOR" | "REFERRER"
            })
          : (currentRole ?? "REFERRER"));

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

      const ready = await this.confirmOrAbort(`Ready to update user ${userId}?`);
      if (!ready) return;

      await client.updateUser.mutate({
        id: userId,
        name,
        phone,
        enabled,
        role,
        ...(newPassword !== undefined && { password: newPassword })
      });

      this.log("Done!");
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
