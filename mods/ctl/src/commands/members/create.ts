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

    // Get users for referrer and collector selection
    const users = await client.listUsers.query({ showDisabled: true });
    const referrers = users.filter((u: { roles?: Array<{ role: string }> }) =>
      u.roles?.some((r: { role: string }) => r.role === "REFERRER")
    );
    const collectors = users.filter((u: { roles?: Array<{ role: string }> }) =>
      u.roles?.some((r: { role: string }) => r.role === "COLLECTOR")
    );

    if (referrers.length === 0) {
      this.error("No referrers found. Please create a user with REFERRER role first.");
      return;
    }
    if (collectors.length === 0) {
      this.error("No collectors found. Please create a user with COLLECTOR role first.");
      return;
    }

    const answers = {
      name: await input({
        message: "Name",
        required: true
      }),
      phone: await input({
        message: "Phone (e.g., +18091234567)",
        required: true
      }),
      idNumber: await input({
        message: "ID Number (format: 000-0000000-0)",
        required: true
      }),
      collectionPoint: await input({
        message: "Collection Point (URL)",
        required: true
      }),
      homeAddress: await input({
        message: "Home Address",
        required: true
      }),
      referredById: await select({
        message: "Referrer",
        choices: referrers.map((u: { name: string; id: string }) => ({
          name: `${u.name} (${u.id})`,
          value: u.id
        }))
      }),
      assignedCollectorId: await select({
        message: "Collector",
        choices: collectors.map((u: { name: string; id: string }) => ({
          name: `${u.name} (${u.id})`,
          value: u.id
        }))
      }),
      jobPosition: await input({
        message: "Job Position (optional)",
        required: false
      }),
      income: await number({
        message: "Monthly Income (optional)",
        required: false
      }),
      isBusinessOwner: await select({
        message: "Is Business Owner?",
        choices: [
          { name: "No", value: false },
          { name: "Yes", value: true }
        ],
        default: false
      }),
      notes: await input({
        message: "Note (optional)",
        required: false
      })
    };

    const ready = await confirm({
      message: "Ready to create member?"
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
        referredById: answers.referredById,
        assignedCollectorId: answers.assignedCollectorId,
        jobPosition: answers.jobPosition || undefined,
        income: answers.income || undefined,
        isBusinessOwner: answers.isBusinessOwner,
        notes: answers.notes || undefined
      });

      this.log("Done!");
      this.log(`Member ID: ${member.id}`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
