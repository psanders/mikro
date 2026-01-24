/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { confirm, input, number, select } from "@inquirer/prompts";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

export default class Create extends BaseCommand<typeof Create> {
  static override readonly description = "create a new member";
  static override readonly examples = ["<%= config.bin %> <%= command.id %>"];

  public async run(): Promise<void> {
    const client = this.createClient();

    this.log("This utility will help you create a Member.");
    this.log("Press ^C at any time to quit.");

    const answers = {
      name: await input({
        message: "Name",
        required: true,
      }),
      phone: await input({
        message: "Phone",
        required: true,
      }),
      idNumber: await input({
        message: "ID Number",
        required: true,
      }),
      collectionPoint: await input({
        message: "Collection Point",
        required: true,
      }),
      homeAddress: await input({
        message: "Home Address",
        required: true,
      }),
      jobPosition: await input({
        message: "Job Position (optional)",
        required: false,
      }),
      income: await number({
        message: "Monthly Income (optional)",
        required: false,
      }),
      isBusinessOwner: await select({
        message: "Is Business Owner?",
        choices: [
          { name: "No", value: false },
          { name: "Yes", value: true },
        ],
        default: false,
      }),
    };

    const ready = await confirm({
      message: "Ready to create member?",
    });

    if (!ready) {
      this.log("Aborted!");
      return;
    }

    try {
      const member = await client.createMember.mutate({
        name: answers.name,
        phone: answers.phone,
        idNumber: answers.idNumber,
        collectionPoint: answers.collectionPoint,
        homeAddress: answers.homeAddress,
        jobPosition: answers.jobPosition || undefined,
        income: answers.income || undefined,
        isBusinessOwner: answers.isBusinessOwner,
      });

      this.log("Done!");
      this.log(`Member ID: ${member.id}`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
