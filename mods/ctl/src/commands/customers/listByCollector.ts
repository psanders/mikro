/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import cliui from "cliui";
import { ListCommand } from "../../ListCommand.js";
import errorHandler from "../../errorHandler.js";

export default class ListByCollector extends ListCommand<typeof ListByCollector> {
  static override readonly description = "display customers by assigned collector";
  static override readonly examples = ["<%= config.bin %> <%= command.id %> <collectorId>"];
  static override readonly args = {
    collectorId: Args.string({
      description: "The Collector ID to filter by",
      required: true
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

    try {
      const customers = await client.listCustomersByCollector.query({
        assignedCollectorId: args.collectorId,
        showInactive: flags["include-inactive"],
        limit: flags["page-size"]
      });

      const ui = cliui({ width: 180 });

      ui.div(
        { text: "ID", padding: [0, 0, 0, 0], width: 38 },
        { text: "NAME", padding: [0, 0, 0, 0], width: 35 },
        { text: "PHONE", padding: [0, 0, 0, 0], width: 18 },
        { text: "ACTIVE", padding: [0, 0, 0, 0], width: 10 }
      );

      customers.forEach((customer) => {
        ui.div(
          { text: customer.id, padding: [0, 0, 0, 0], width: 38 },
          { text: customer.name, padding: [0, 0, 0, 0], width: 35 },
          { text: customer.phone, padding: [0, 0, 0, 0], width: 18 },
          { text: customer.isActive ? "Yes" : "No", padding: [0, 0, 0, 0], width: 10 }
        );
      });

      this.log(ui.toString());
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
