/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import { promptTextIfMissing, promptConfirmIfMissing } from "../../lib/prompts.js";

export default class Create extends BaseCommand<typeof Create> {
  static override readonly description = "create a new member";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --name 'John Doe' --phone '+18091234567' --id-number '123-4567890-1' --home-address '123 Main St' --referrer-id abc-def --collector-id xyz-123 --yes"
  ];
  static override readonly flags = {
    name: Flags.string({
      description: "Member name",
      required: false
    }),
    phone: Flags.string({
      description: "Phone number (e.g., +18091234567)",
      required: false
    }),
    "id-number": Flags.string({
      description: "ID Number (format: 000-0000000-0)",
      required: false
    }),
    "collection-point": Flags.string({
      description: "Collection Point URL (optional)",
      required: false
    }),
    "home-address": Flags.string({
      description: "Home Address",
      required: false
    }),
    "referrer-id": Flags.string({
      description: "Referrer User ID",
      required: false
    }),
    "collector-id": Flags.string({
      description: "Collector User ID",
      required: false
    }),
    "job-position": Flags.string({
      description: "Job Position (optional)",
      required: false
    }),
    income: Flags.integer({
      description: "Monthly Income (optional)",
      required: false
    }),
    "is-business-owner": Flags.boolean({
      description: "Is Business Owner",
      required: false
    }),
    notes: Flags.string({
      description: "Note (optional)",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Create);
    const client = this.createClient();

    if (!flags.yes) {
      this.log("This utility will help you create a Member.");
      this.log("Press ^C at any time to quit.");
    }

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

    const name = await promptTextIfMissing(flags.name, "Name", "name");
    const phone = await promptTextIfMissing(flags.phone, "Phone (e.g., +18091234567)", "phone");
    const idNumber = await promptTextIfMissing(
      flags["id-number"],
      "ID Number (format: 000-0000000-0)",
      "id-number"
    );
    const collectionPoint = flags["collection-point"] || undefined;
    const homeAddress = await promptTextIfMissing(
      flags["home-address"],
      "Home Address",
      "home-address"
    );
    const referredById = flags["referrer-id"]
      ? flags["referrer-id"]
      : await select({
          message: "Referrer",
          choices: referrers.map((u: { name: string; id: string }) => ({
            name: `${u.name} (${u.id})`,
            value: u.id
          }))
        });
    const assignedCollectorId = flags["collector-id"]
      ? flags["collector-id"]
      : await select({
          message: "Collector",
          choices: collectors.map((u: { name: string; id: string }) => ({
            name: `${u.name} (${u.id})`,
            value: u.id
          }))
        });
    const jobPosition = flags["job-position"] || undefined;
    const income = flags.income || undefined;
    const isBusinessOwner =
      flags["is-business-owner"] !== undefined
        ? flags["is-business-owner"]
        : await select({
            message: "Is Business Owner?",
            choices: [
              { name: "No", value: false },
              { name: "Yes", value: true }
            ],
            default: false
          });
    const notes = flags.notes || undefined;

    const ready = await promptConfirmIfMissing(
      flags.yes ? true : undefined,
      "Ready to create member?",
      "yes"
    );

    if (!ready) {
      this.log("Aborted!");
      return;
    }

    try {
      const member = await client.createMember.mutate({
        name,
        phone,
        idNumber,
        collectionPoint,
        homeAddress,
        referredById,
        assignedCollectorId,
        jobPosition,
        income,
        isBusinessOwner,
        notes
      });

      this.log("Done!");
      this.log(`Member ID: ${member.id}`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
