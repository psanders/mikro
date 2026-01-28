/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import {
  promptTextIfMissing,
  promptSelectIfMissing,
  promptConfirmIfMissing
} from "../../lib/prompts.js";

export default class Create extends BaseCommand<typeof Create> {
  static override readonly description = "create a new user";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --name 'John Doe' --phone '+1234567890' --role COLLECTOR",
    "<%= config.bin %> <%= command.id %> --name 'John Doe' --phone '+1234567890' --role COLLECTOR --yes"
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
      options: ["ADMIN", "COLLECTOR", "REFERRER"],
      required: false
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Create);
    const client = this.createClient();

    if (!flags.yes) {
      this.log("This utility will help you create a User.");
      this.log("Press ^C at any time to quit.");
    }

    const name = await promptTextIfMissing(flags.name, "Name", "name");
    const phone = await promptTextIfMissing(flags.phone, "Phone", "phone");
    const role = await promptSelectIfMissing(
      flags.role as "ADMIN" | "COLLECTOR" | "REFERRER" | undefined,
      "Role",
      "role",
      [
        { name: "Admin", value: "ADMIN" as const },
        { name: "Collector", value: "COLLECTOR" as const },
        { name: "Referrer", value: "REFERRER" as const }
      ]
    );

    const ready = await promptConfirmIfMissing(
      flags.yes ? true : undefined,
      "Ready to create user?",
      "yes"
    );

    if (!ready) {
      this.log("Aborted!");
      return;
    }

    try {
      const user = await client.createUser.mutate({
        name,
        phone,
        role
      });

      this.log("Done!");
      this.log(`User ID: ${user.id}`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
