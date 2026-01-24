/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { confirm, input, select } from "@inquirer/prompts";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

export default class Create extends BaseCommand<typeof Create> {
  static override readonly description = "create a new user";
  static override readonly examples = ["<%= config.bin %> <%= command.id %>"];

  public async run(): Promise<void> {
    const client = this.createClient();

    this.log("This utility will help you create a User.");
    this.log("Press ^C at any time to quit.");

    const answers = {
      name: await input({
        message: "Name",
        required: true
      }),
      phone: await input({
        message: "Phone",
        required: true
      }),
      role: await select({
        message: "Role",
        choices: [
          { name: "Admin", value: "ADMIN" as const },
          { name: "Collector", value: "COLLECTOR" as const },
          { name: "Referrer", value: "REFERRER" as const }
        ]
      })
    };

    const ready = await confirm({
      message: "Ready to create user?"
    });

    if (!ready) {
      this.log("Aborted!");
      return;
    }

    try {
      const user = await client.createUser.mutate({
        name: answers.name,
        phone: answers.phone,
        role: answers.role
      });

      this.log("Done!");
      this.log(`User ID: ${user.id}`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
