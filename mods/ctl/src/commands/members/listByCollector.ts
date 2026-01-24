/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import cliui from "cliui";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

export default class ListByCollector extends BaseCommand<typeof ListByCollector> {
  static override readonly description = "display members by assigned collector";
  static override readonly examples = ["<%= config.bin %> <%= command.id %> <collector-id>"];
  static override readonly args = {
    id: Args.string({
      description: "The Collector ID to filter by",
      required: true
    })
  };
  static override readonly flags = {
    "show-inactive": Flags.boolean({
      char: "a",
      description: "show all members including inactive",
      default: false
    }),
    "page-size": Flags.string({
      char: "s",
      description: "the number of items to show",
      default: "100",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(ListByCollector);
    const client = this.createClient();

    try {
      const members = await client.listMembersByCollector.query({
        assignedCollectorId: args.id,
        showInactive: flags["show-inactive"],
        limit: parseInt(flags["page-size"])
      });

      const ui = cliui({ width: 170 });

      ui.div(
        { text: "ID", padding: [0, 0, 0, 0], width: 40 },
        { text: "NAME", padding: [0, 0, 0, 0], width: 35 },
        { text: "PHONE", padding: [0, 0, 0, 0], width: 18 },
        { text: "ACTIVE", padding: [0, 0, 0, 0], width: 10 }
      );

      members.forEach((member) => {
        ui.div(
          { text: member.id, padding: [0, 0, 0, 0], width: 40 },
          { text: member.name, padding: [0, 0, 0, 0], width: 35 },
          { text: member.phone, padding: [0, 0, 0, 0], width: 18 },
          { text: member.isActive ? "Yes" : "No", padding: [0, 0, 0, 0], width: 10 }
        );
      });

      this.log(ui.toString());
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
