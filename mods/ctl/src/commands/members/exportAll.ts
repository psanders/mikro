/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import { outputMembersAsCsv, outputMembersAsTable } from "../../lib/exportUtils.js";

export default class ExportAll extends BaseCommand<typeof ExportAll> {
  static override readonly description = "export all active members (admin only)";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --csv",
    "<%= config.bin %> <%= command.id %> --csv > report.csv"
  ];
  static override readonly flags = {
    csv: Flags.boolean({
      description: "Output as CSV format",
      default: false
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ExportAll);
    const client = this.createClient();

    try {
      const members = await client.exportAllMembers.query({});

      if (members.length === 0) {
        this.log("No hay miembros activos en el sistema.");
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
