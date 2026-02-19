/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import { handleCustomersOutput, outputCustomersAsTable } from "../../lib/exportUtils.js";

export default class ExportAll extends BaseCommand<typeof ExportAll> {
  static override readonly description = "export all active customers (admin only)";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --output report.xlsx",
    "<%= config.bin %> <%= command.id %> --output report.png",
    "<%= config.bin %> <%= command.id %> --output report.csv"
  ];
  static override readonly flags = {
    output: Flags.string({
      description:
        "Write report to file. Extension determines format: .xlsx (Excel), .png (simplified image), .csv (extended CSV).",
      char: "o"
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ExportAll);
    const client = this.createClient();

    try {
      const customers = await client.exportAllCustomers.query({});

      if (customers.length === 0) {
        this.log("No hay clientes activos en el sistema.");
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
