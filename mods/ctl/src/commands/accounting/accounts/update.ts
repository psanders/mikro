/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { input, select } from "@inquirer/prompts";
import { Args, Flags } from "@oclif/core";
import { formatMoney, type UpdateAccountInput } from "@mikro/common";
import { MutationCommand } from "../../../MutationCommand.js";
import errorHandler from "../../../errorHandler.js";
import { promptAccountSelectIfMissing } from "../../../lib/prompts.js";

type AccountKind = "BANK" | "CASH" | "CREDIT_CARD" | "OTHER";

export default class Update extends MutationCommand<typeof Update> {
  static override readonly description = "update an accounting account (name, kind, active flag)";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> <accountId> --name 'New Name'",
    "<%= config.bin %> <%= command.id %> <accountId> --is-active false"
  ];
  static override readonly args = {
    accountId: Args.string({
      description: "Account ID",
      required: false
    })
  };
  static override readonly flags = {
    name: Flags.string({ description: "New name", required: false }),
    kind: Flags.string({
      description: "New kind",
      options: ["BANK", "CASH", "CREDIT_CARD", "OTHER"],
      required: false
    }),
    currency: Flags.string({ description: "New currency (ISO-4217)", required: false }),
    "is-active": Flags.boolean({
      description: "Set active flag",
      required: false,
      allowNo: true
    }),
    notes: Flags.string({ description: "New notes (empty string clears)", required: false })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Update);
    const client = this.createClient();

    const id = await promptAccountSelectIfMissing(
      client,
      args.accountId,
      "Account to update",
      "accountId",
      { includeInactive: true }
    );

    const existing = await client.accounting.listAccounts.query({ includeInactive: true });
    const account = existing.find((a) => a.id === id);
    if (!account) {
      this.error(`Account not found: ${id}`);
      return;
    }

    const name =
      flags.name ??
      (process.stdout.isTTY
        ? await input({ message: "Name", default: account.name, required: true })
        : account.name);

    const kind: AccountKind =
      (flags.kind as AccountKind | undefined) ??
      (process.stdout.isTTY
        ? await select({
            message: "Kind",
            choices: [
              { name: "Bank", value: "BANK" as const },
              { name: "Cash", value: "CASH" as const },
              { name: "Credit Card", value: "CREDIT_CARD" as const },
              { name: "Other", value: "OTHER" as const }
            ],
            default: account.kind as AccountKind
          })
        : (account.kind as AccountKind));

    const currency =
      flags.currency ??
      (process.stdout.isTTY
        ? await input({ message: "Currency", default: account.currency, required: true })
        : account.currency);

    const isActive =
      flags["is-active"] !== undefined
        ? flags["is-active"]
        : process.stdout.isTTY
          ? await select({
              message: "Active",
              choices: [
                { name: "Yes", value: true },
                { name: "No", value: false }
              ],
              default: account.isActive
            })
          : account.isActive;

    let notes: string | null | undefined;
    if (flags.notes !== undefined) {
      notes = flags.notes === "" ? null : flags.notes;
    } else if (process.stdout.isTTY) {
      const n = await input({
        message: "Notes (blank to clear)",
        default: "",
        required: false
      });
      notes = n.trim() === "" ? null : n.trim();
    }

    const payload: UpdateAccountInput = { id };
    if (flags.name !== undefined || process.stdout.isTTY) payload.name = name;
    if (flags.kind !== undefined || process.stdout.isTTY) payload.kind = kind;
    if (flags.currency !== undefined || process.stdout.isTTY) payload.currency = currency;
    if (flags["is-active"] !== undefined || process.stdout.isTTY) payload.isActive = isActive;
    if (flags.notes !== undefined || (process.stdout.isTTY && notes !== undefined)) {
      payload.notes = notes ?? null;
    }

    const ready = await this.confirmOrAbort(`Update account "${name}"?`);
    if (!ready) return;

    try {
      const updated = await client.accounting.updateAccount.mutate(payload);
      this.log("Account updated.");
      this.log(`  Name: ${updated.name}`);
      this.log(`  Kind: ${updated.kind}`);
      this.log(`  Currency: ${updated.currency}`);
      this.log(`  Balance: ${formatMoney(updated.currentBalance)}`);
      this.log(`  Active: ${updated.isActive}`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
