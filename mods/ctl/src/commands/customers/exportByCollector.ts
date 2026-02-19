/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import { handleCustomersOutput, outputCustomersAsTable } from "../../lib/exportUtils.js";
import { promptUserSelectIfMissing } from "../../lib/prompts.js";

export default class ExportByCollector extends BaseCommand<typeof ExportByCollector> {
  static override readonly description = "export customers assigned to a collector";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <collectorId>",
    "<%= config.bin %> <%= command.id %> <collectorId> --output report.xlsx",
    "<%= config.bin %> <%= command.id %> <collectorId> --output report.png",
    "<%= config.bin %> <%= command.id %> <collectorId> --output report.csv"
  ];
  static override readonly args = {
    collectorId: Args.string({
      description: "The Collector ID to export customers for",
      required: false
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

    const collectorId = await promptUserSelectIfMissing(
      client,
      args.collectorId,
      "Collector",
      "collectorId",
      { role: "COLLECTOR" }
    );

    try {
      const customers = await client.exportCollectorCustomers.query({
        assignedCollectorId: collectorId
      });

      if (customers.length === 0) {
        this.log("No hay clientes asignados a este cobrador.");
        return;
      }

      const handled = await handleCustomersOutput(
        customers,
        flags.output,
        this.log.bind(this),
        this.error.bind(this)
      );
      if (!handled) {
        outputCustomersAsTable(customers, this.log.bind(this));
      }
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
