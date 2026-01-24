/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { confirm, input, select } from "@inquirer/prompts";
import { Args } from "@oclif/core";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

export default class Update extends BaseCommand<typeof Update> {
  static override readonly description = "modify a member's information";
  static override readonly examples = ["<%= config.bin %> <%= command.id %> <member-id>"];
  static override readonly args = {
    ref: Args.string({
      description: "The Member ID to update",
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(Update);
    const client = this.createClient();

    try {
      const memberFromDB = await client.getMember.query({ id: args.ref });

      if (!memberFromDB) {
        this.error("Member not found.");
        return;
      }

      this.log("This utility will help you update a Member.");
      this.log("Press ^C at any time to quit.");

      const answers = {
        name: await input({
          message: "Name",
          default: memberFromDB.name,
          required: true,
        }),
        phone: await input({
          message: "Phone",
          default: memberFromDB.phone,
          required: true,
        }),
        isActive: await select({
          message: "Active Status",
          choices: [
            { name: "Active", value: true },
            { name: "Inactive", value: false },
          ],
          default: memberFromDB.isActive,
        }),
      };

      const ready = await confirm({
        message: "Ready to update member?",
      });

      if (!ready) {
        this.log("Aborted!");
        return;
      }

      await client.updateMember.mutate({
        id: args.ref,
        name: answers.name,
        phone: answers.phone,
        isActive: answers.isActive,
      });

      this.log("Done!");
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
