/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import { handleCustomersOutput, outputCustomersAsTable } from "../../lib/exportUtils.js";
import { promptUserSelectIfMissing } from "../../lib/prompts.js";

export default class ReportsCustomers extends BaseCommand<typeof ReportsCustomers> {
  static override readonly description =
    "export customers report (all, by collector, or by referrer). Default: all active customers (admin only).";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --collector <id>",
    "<%= config.bin %> <%= command.id %> --referrer <id>",
    "<%= config.bin %> <%= command.id %> --output report.xlsx",
    "<%= config.bin %> <%= command.id %> --collector <id> --output report.png"
  ];

  static override readonly flags = {
    collector: Flags.string({
      description: "Filter by collector ID (prompts interactively if omitted)",
      exclusive: ["referrer"]
    }),
    referrer: Flags.string({
      description: "Filter by referrer ID (prompts interactively if omitted)",
      exclusive: ["collector"]
    }),
    output: Flags.string({
      description:
        "Write report to file. Extension determines format: .xlsx (Excel), .png (simplified image), .csv (extended CSV).",
      char: "o"
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ReportsCustomers);
    const client = this.createClient();

    if (flags.collector !== undefined && flags.referrer !== undefined) {
      this.error("Cannot use --collector and --referrer together. Choose one.");
    }

    try {
      let customers: Awaited<ReturnType<typeof client.exportAllCustomers.query>>;

      if (flags.collector !== undefined) {
        const collectorId = await promptUserSelectIfMissing(
          client,
          flags.collector || undefined,
          "Collector",
          "collector",
          { role: "COLLECTOR" }
        );
        customers = await client.exportCollectorCustomers.query({
          assignedCollectorId: collectorId
        });
        if (customers.length === 0) {
          this.log("No hay clientes asignados a este cobrador.");
          return;
        }
      } else if (flags.referrer !== undefined) {
        const referrerId = await promptUserSelectIfMissing(
          client,
          flags.referrer || undefined,
          "Referrer",
          "referrer",
          { role: "REFERRER" }
        );
        customers = await client.exportCustomersByReferrer.query({
          referredById: referrerId
        });
        if (customers.length === 0) {
          this.log("No hay clientes referidos por este usuario.");
          return;
        }
      } else {
        customers = await client.exportAllCustomers.query({});
        if (customers.length === 0) {
          this.log("No hay clientes activos en el sistema.");
          return;
        }
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
