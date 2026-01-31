/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import { outputMembersAsCsv, outputMembersAsTable } from "../../lib/exportUtils.js";

export default class ExportByReferrer extends BaseCommand<typeof ExportByReferrer> {
  static override readonly description = "export members referred by a user";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <referrerId>",
    "<%= config.bin %> <%= command.id %> <referrerId> --csv",
    "<%= config.bin %> <%= command.id %> <referrerId> --csv > report.csv"
  ];
  static override readonly args = {
    referrerId: Args.string({
      description: "The Referrer ID to export members for",
      required: true
    })
  };
  static override readonly flags = {
    csv: Flags.boolean({
      description: "Output as CSV format",
      default: false
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

      if (flags.csv) {
        outputMembersAsCsv(members, this.log.bind(this));
      } else {
        outputMembersAsTable(members, this.log.bind(this));
      }
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
