/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import type { UpdateAccountInput } from "@mikro/common";
import { BaseCommand } from "../../../BaseCommand.js";
import errorHandler from "../../../errorHandler.js";
import { promptAccountSelectIfMissing } from "../../../lib/prompts.js";

type AccountKind = "BANK" | "CASH" | "CREDIT_CARD" | "OTHER";

export default class Update extends BaseCommand<typeof Update> {
  static override readonly description = "update an accounting account (name, kind, active flag)";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --id <uuid> --active false"
  ];
  static override readonly flags = {
    id: Flags.string({ description: "Account ID", required: false }),
    name: Flags.string({ description: "New name", required: false }),
    kind: Flags.string({
      description: "New kind",
      options: ["BANK", "CASH", "CREDIT_CARD", "OTHER"],
      required: false
    }),
    currency: Flags.string({ description: "New currency (ISO-4217)", required: false }),
    active: Flags.string({
      description: "Set active flag (true/false)",
      options: ["true", "false"],
      required: false
    }),
    notes: Flags.string({ description: "New notes (empty string clears)", required: false })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Update);
    const client = this.createClient();

    const id = await promptAccountSelectIfMissing(client, flags.id, "Account to update", "id", {
      includeInactive: true
    });

    const payload: UpdateAccountInput = { id };
    if (flags.name !== undefined) payload.name = flags.name;
    if (flags.kind !== undefined) payload.kind = flags.kind as AccountKind;
    if (flags.currency !== undefined) payload.currency = flags.currency;
    if (flags.active !== undefined) payload.isActive = flags.active === "true";
    if (flags.notes !== undefined) payload.notes = flags.notes === "" ? null : flags.notes;

    try {
      const updated = await client.accounting.updateAccount.mutate(payload);
      this.log("Account updated.");
      this.log(`  Name: ${updated.name}`);
      this.log(`  Kind: ${updated.kind}`);
      this.log(`  Currency: ${updated.currency}`);
      this.log(`  Balance: ${updated.currentBalance}`);
      this.log(`  Active: ${updated.isActive}`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
