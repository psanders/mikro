/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { password } from "@inquirer/prompts";
import { Flags } from "@oclif/core";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";
import { promptTextIfMissing, promptSelectIfMissing } from "../../lib/prompts.js";

export default class Create extends MutationCommand<typeof Create> {
  static override readonly description = "create a new user";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --name 'John Doe' --phone '+1234567890' --role COLLECTOR",
    "<%= config.bin %> <%= command.id %> --name 'John Doe' --phone '+1234567890' --password 'secret'"
  ];
  static override readonly flags = {
    name: Flags.string({
      description: "User name",
      required: false
    }),
    phone: Flags.string({
      description: "Phone number",
      required: false
    }),
    role: Flags.string({
      description: "User role",
      options: ["ADMIN", "COLLECTOR", "REVIEWER"],
      required: false
    }),
    password: Flags.string({
      description: "Password (omit to be prompted or leave blank)",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Create);
    const client = this.createClient();

    this.log("This utility will help you create a User.");
    this.log("Press ^C at any time to quit.");

    const name = await promptTextIfMissing(flags.name, "Name", "name");
    const phone = await promptTextIfMissing(flags.phone, "Phone", "phone");
    const role = await promptSelectIfMissing(
      flags.role as "ADMIN" | "COLLECTOR" | "REVIEWER" | undefined,
      "Role",
      "role",
      [
        { name: "Admin", value: "ADMIN" as const },
        { name: "Collector", value: "COLLECTOR" as const },
        { name: "Reviewer", value: "REVIEWER" as const }
      ]
    );

    let passwordValue: string | undefined = flags.password ?? undefined;
    if (passwordValue === undefined && process.stdout.isTTY) {
      const entered = await password({
        message: "Password (leave blank for none)",
        mask: true
      });
      if (entered.length > 0) {
        passwordValue = entered;
      }
    }

    const ready = await this.confirmOrAbort("Ready to create user?");
    if (!ready) return;

    try {
      const user = await client.createUser.mutate({
        name,
        phone,
        role,
        ...(passwordValue !== undefined && passwordValue.length > 0 && { password: passwordValue })
      });

      this.log("Done!");
      this.log(`User ID: ${user.id}`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
