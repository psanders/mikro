/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { confirm, input, select } from "@inquirer/prompts";
import { Args } from "@oclif/core";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import {
  PREFERRED_PAYMENT_DAY_CHOICES,
  type PreferredPaymentDay
} from "../../lib/preferredPaymentDay.js";

export default class Update extends BaseCommand<typeof Update> {
  static override readonly description = "modify a customer's information";
  static override readonly examples = ["<%= config.bin %> <%= command.id %> <customerId>"];
  static override readonly args = {
    customerId: Args.string({
      description: "The Customer ID to update",
      required: true
    })
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(Update);
    const client = this.createClient();

    try {
      const customerFromDB = await client.getCustomer.query({ id: args.customerId });

      if (!customerFromDB) {
        this.error("Customer not found.");
        return;
      }

      this.log("This utility will help you update a Customer.");
      this.log("Press ^C at any time to quit.");

      const paymentDayChoices: Array<{ name: string; value: PreferredPaymentDay | null }> = [
        { name: "None", value: null },
        ...PREFERRED_PAYMENT_DAY_CHOICES
      ];

      const answers = {
        name: await input({
          message: "Name",
          default: customerFromDB.name,
          required: true
        }),
        phone: await input({
          message: "Phone (e.g., 18091234567)",
          default: customerFromDB.phone,
          required: true
        }),
        notes: await input({
          message: "Note (optional)",
          default: customerFromDB.notes || "",
          required: false
        }),
        isActive: await select({
          message: "Active Status",
          choices: [
            { name: "Active", value: true },
            { name: "Inactive", value: false }
          ],
          default: customerFromDB.isActive
        }),
        preferredPaymentDay: await select({
          message: "Preferred payment day",
          choices: paymentDayChoices,
          default: (customerFromDB.preferredPaymentDay as PreferredPaymentDay | null) ?? null
        })
      };

      const ready = await confirm({ message: "Ready to update customer?" });

      if (!ready) {
        this.log("Aborted!");
        return;
      }

      await client.updateCustomer.mutate({
        id: args.customerId,
        name: answers.name,
        phone: answers.phone,
        notes: answers.notes || undefined,
        isActive: answers.isActive,
        preferredPaymentDay: answers.preferredPaymentDay
      });

      this.log("Done!");
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
