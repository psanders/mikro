/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import { handleMembersOutput, outputMembersAsTable } from "../../lib/exportUtils.js";

export default class ExportByCollector extends BaseCommand<typeof ExportByCollector> {
  static override readonly description = "export members assigned to a collector";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <collectorId>",
    "<%= config.bin %> <%= command.id %> <collectorId> --output report.xlsx",
    "<%= config.bin %> <%= command.id %> <collectorId> --output report.png",
    "<%= config.bin %> <%= command.id %> <collectorId> --output report.csv"
  ];
  static override readonly args = {
    collectorId: Args.string({
      description: "The Collector ID to export members for",
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
    const { args, flags } = await this.parse(ExportByCollector);
    const client = this.createClient();

    try {
      const members = await client.exportCollectorMembers.query({
        assignedCollectorId: args.collectorId
      });

      if (members.length === 0) {
        this.log("No hay miembros asignados a este cobrador.");
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
