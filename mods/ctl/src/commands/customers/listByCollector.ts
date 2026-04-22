/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import cliui from "cliui";
import { ListCommand } from "../../ListCommand.js";
import errorHandler from "../../errorHandler.js";
import { cliuiCells, cliuiTableWidth, computeColumnWidths } from "../../lib/cliTableLayout.js";
import { promptUserSelectIfMissing } from "../../lib/prompts.js";

export default class ListByCollector extends ListCommand<typeof ListByCollector> {
  static override readonly description = "display customers by assigned collector";
  static override readonly examples = ["<%= config.bin %> <%= command.id %> <collectorId>"];
  static override readonly args = {
    collectorId: Args.string({
      description: "The Collector ID to filter by",
      required: false
    })
  };
  static override readonly flags = {
    "include-inactive": Flags.boolean({
      char: "a",
      description: "include inactive customers",
      default: false
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(ListByCollector);
    const client = this.createClient();

    const collectorId = await promptUserSelectIfMissing(
      client,
      args.collectorId,
      "Collector",
      "collectorId",
      { role: "COLLECTOR" }
    );

    try {
      const customers = await client.listCustomersByCollector.query({
        assignedCollectorId: collectorId,
        showInactive: flags["include-inactive"],
        limit: flags["page-size"]
      });

      const headers = ["ID", "NAME", "NICKNAME", "PHONE", "ACTIVE", "NOTIFICATIONS"];
      const rows = customers.map((customer) => {
        const np = customer.notificationPolicy;
        const notifications = np
          ? [np.collections && "Collections", np.paymentConfirmations && "Payments"]
              .filter(Boolean)
              .join(", ") || "None"
          : "N/A";
        return [
          customer.id,
          customer.name,
          customer.nickname ?? "",
          customer.phone,
          customer.isActive ? "Yes" : "No",
          notifications
        ];
      });
      const widths = computeColumnWidths({
        headers,
        rows,
        minWidths: [undefined, undefined, undefined, undefined, 8, 15],
        maxWidths: [undefined, undefined, undefined, undefined, undefined, 48]
      });
      const ui = cliui({ width: cliuiTableWidth(widths) });
      ui.div(...cliuiCells(headers, widths));
      for (const row of rows) {
        ui.div(...cliuiCells(row, widths));
      }

      this.log(ui.toString());
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
