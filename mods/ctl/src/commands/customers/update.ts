/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { input, select } from "@inquirer/prompts";
import { Args, Flags } from "@oclif/core";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";
import {
  PREFERRED_PAYMENT_DAY_CHOICES,
  PREFERRED_PAYMENT_DAY_OPTIONS,
  type PreferredPaymentDay
} from "../../lib/preferredPaymentDay.js";
import { promptCustomerSelectIfMissing } from "../../lib/prompts.js";

export default class Update extends MutationCommand<typeof Update> {
  static override readonly description = "modify a customer's information";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <customerId>",
    "<%= config.bin %> <%= command.id %> <customerId> --name 'Jane Doe' --phone '+18091234567'"
  ];
  static override readonly args = {
    customerId: Args.string({
      description: "The Customer ID to update",
      required: false
    })
  };
  static override readonly flags = {
    name: Flags.string({ description: "Customer name", required: false }),
    nickname: Flags.string({
      description: "Nickname (empty string clears)",
      required: false
    }),
    phone: Flags.string({ description: "Phone number", required: false }),
    notes: Flags.string({ description: "Notes", required: false }),
    "is-active": Flags.boolean({
      description: "Active status",
      required: false,
      allowNo: true
    }),
    "preferred-payment-day": Flags.string({
      description: "Preferred payment day (MONDAY-SUNDAY or none)",
      required: false,
      options: [...PREFERRED_PAYMENT_DAY_OPTIONS, "none"]
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Update);
    const client = this.createClient();

    const customerId = await promptCustomerSelectIfMissing(
      client,
      args.customerId,
      "Customer to update",
      "customerId"
    );

    try {
      const customerFromDB = await client.getCustomer.query({ id: customerId });

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

      const name =
        flags.name ??
        (process.stdout.isTTY
          ? await input({ message: "Name", default: customerFromDB.name, required: true })
          : customerFromDB.name);

      let nickname: string | null;
      if (flags.nickname !== undefined) {
        nickname = flags.nickname.trim() === "" ? null : flags.nickname.trim();
      } else if (process.stdout.isTTY) {
        const n = await input({
          message: "Nickname (optional, blank to clear)",
          default: customerFromDB.nickname ?? "",
          required: false
        });
        nickname = n.trim() === "" ? null : n.trim();
      } else {
        nickname = customerFromDB.nickname ?? null;
      }

      const phone =
        flags.phone ??
        (process.stdout.isTTY
          ? await input({ message: "Phone", default: customerFromDB.phone, required: true })
          : customerFromDB.phone);

      const notes =
        flags.notes !== undefined
          ? flags.notes
          : process.stdout.isTTY
            ? await input({
                message: "Note (optional)",
                default: customerFromDB.notes || "",
                required: false
              })
            : customerFromDB.notes || undefined;

      const isActive =
        flags["is-active"] !== undefined
          ? flags["is-active"]
          : process.stdout.isTTY
            ? await select({
                message: "Active Status",
                choices: [
                  { name: "Active", value: true },
                  { name: "Inactive", value: false }
                ],
                default: customerFromDB.isActive
              })
            : customerFromDB.isActive;

      const preferredPaymentDay: PreferredPaymentDay | null =
        flags["preferred-payment-day"] !== undefined
          ? flags["preferred-payment-day"] === "none"
            ? null
            : (flags["preferred-payment-day"] as PreferredPaymentDay)
          : process.stdout.isTTY
            ? await select({
                message: "Preferred payment day",
                choices: paymentDayChoices,
                default: (customerFromDB.preferredPaymentDay as PreferredPaymentDay | null) ?? null
              })
            : ((customerFromDB.preferredPaymentDay as PreferredPaymentDay | null) ?? null);

      const ready = await this.confirmOrAbort(`Ready to update customer ${customerId}?`);
      if (!ready) return;

      await client.updateCustomer.mutate({
        id: customerId,
        name,
        nickname,
        phone,
        notes: notes || undefined,
        isActive,
        preferredPaymentDay
      });

      this.log("Done!");
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
