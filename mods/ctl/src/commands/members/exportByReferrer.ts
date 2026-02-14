/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import { handleMembersOutput, outputMembersAsTable } from "../../lib/exportUtils.js";

export default class ExportByReferrer extends BaseCommand<typeof ExportByReferrer> {
  static override readonly description = "export members referred by a user";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <referrerId>",
    "<%= config.bin %> <%= command.id %> <referrerId> --output report.xlsx",
    "<%= config.bin %> <%= command.id %> <referrerId> --output report.png",
    "<%= config.bin %> <%= command.id %> <referrerId> --output report.csv"
  ];
  static override readonly args = {
    referrerId: Args.string({
      description: "The Referrer ID to export members for",
      required: true
    })
  };
  static override readonly flags = {
    output: Flags.string({
      description:
        "Write report to file. Extension determines format: .xlsx (Excel), .png (simplified image), .csv (extended CSV).",
      char: "o"
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(ExportByReferrer);
    const client = this.createClient();

    try {
      const members = await client.exportMembersByReferrer.query({
        referredById: args.referrerId
      });

      if (members.length === 0) {
        this.log("No hay miembros referidos por este usuario.");
        return;
      }

      const handled = await handleMembersOutput(
        members,
        flags.output,
        this.log.bind(this),
        this.error.bind(this)
      );
      if (!handled) {
        outputMembersAsTable(members, this.log.bind(this));
      }
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
