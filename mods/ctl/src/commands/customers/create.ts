/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import { confirm, select } from "@inquirer/prompts";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import {
  PREFERRED_PAYMENT_DAY_CHOICES,
  PREFERRED_PAYMENT_DAY_OPTIONS,
  type PreferredPaymentDay
} from "../../lib/preferredPaymentDay.js";
import { promptTextIfMissing, promptUserSelectIfMissing } from "../../lib/prompts.js";

export default class Create extends BaseCommand<typeof Create> {
  static override readonly description = "create a new customer";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --name 'John Doe' --phone '+18091234567' --id-number '123-4567890-1' --home-address '123 Main St' --referrer-id abc-def --collector-id xyz-123"
  ];
  static override readonly flags = {
    name: Flags.string({
      description: "Customer name",
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
    }),
    "preferred-payment-day": Flags.string({
      description: "Preferred payment day (MONDAY-SUNDAY or none)",
      required: false,
      options: [...PREFERRED_PAYMENT_DAY_OPTIONS, "none"]
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Create);
    const client = this.createClient();

    this.log("This utility will help you create a Customer.");
    this.log("Press ^C at any time to quit.");

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
    const referredById = await promptUserSelectIfMissing(
      client,
      flags["referrer-id"],
      "Referrer",
      "referrer-id",
      { role: "REFERRER" }
    );
    const assignedCollectorId = await promptUserSelectIfMissing(
      client,
      flags["collector-id"],
      "Collector",
      "collector-id",
      { role: "COLLECTOR" }
    );
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
    const paymentDayChoices: Array<{ name: string; value: PreferredPaymentDay | null }> = [
      { name: "None", value: null },
      ...PREFERRED_PAYMENT_DAY_CHOICES
    ];
    const preferredPaymentDay: PreferredPaymentDay | null =
      flags["preferred-payment-day"] !== undefined
        ? flags["preferred-payment-day"] === "none"
          ? null
          : (flags["preferred-payment-day"] as PreferredPaymentDay)
        : await select({
            message: "Preferred payment day",
            choices: paymentDayChoices,
            default: null
          });
    const notes = flags.notes || undefined;

    const ready = await confirm({ message: "Ready to create customer?" });

    if (!ready) {
      this.log("Aborted!");
      return;
    }

    try {
      const customer = await client.createCustomer.mutate({
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
        preferredPaymentDay,
        notes
      });

      this.log("Done!");
      this.log(`Customer ID: ${customer.id}`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
