/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import cliui from "cliui";
import { ListCommand } from "../../ListCommand.js";
import errorHandler from "../../errorHandler.js";

export default class List extends ListCommand<typeof List> {
  static override readonly description = "display all customers";
  static override readonly examples = ["<%= config.bin %> <%= command.id %>"];
  static override readonly flags = {
    "include-inactive": Flags.boolean({
      char: "a",
      description: "include inactive customers",
      default: false
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(List);
    const client = this.createClient();

    try {
      const customers = await client.listCustomers.query({
        showInactive: flags["include-inactive"],
        limit: flags["page-size"]
      });

      const ui = cliui({ width: 220 });

      ui.div(
        { text: "ID", padding: [0, 0, 0, 0], width: 38 },
        { text: "NAME", padding: [0, 0, 0, 0], width: 32 },
        { text: "NICKNAME", padding: [0, 0, 0, 0], width: 32 },
        { text: "PHONE", padding: [0, 0, 0, 0], width: 16 },
        { text: "ACTIVE", padding: [0, 0, 0, 0], width: 8 },
        { text: "NOTIFICATIONS", padding: [0, 0, 0, 0], width: 20 }
      );

      customers.forEach((customer) => {
        const np = customer.notificationPolicy;
        const notifications = np
          ? [np.collections && "Collections", np.paymentConfirmations && "Payments"]
              .filter(Boolean)
              .join(", ") || "None"
          : "N/A";
        ui.div(
          { text: customer.id, padding: [0, 0, 0, 0], width: 38 },
          { text: customer.name, padding: [0, 0, 0, 0], width: 32 },
          { text: customer.nickname ?? "", padding: [0, 0, 0, 0], width: 32 },
          { text: customer.phone, padding: [0, 0, 0, 0], width: 16 },
          { text: customer.isActive ? "Yes" : "No", padding: [0, 0, 0, 0], width: 8 },
          { text: notifications, padding: [0, 0, 0, 0], width: 20 }
        );
      });

      this.log(ui.toString());
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
