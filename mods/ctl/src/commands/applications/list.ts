/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import cliui from "cliui";
import {
  applicationStatusEnum,
  applicationOriginEnum,
  applicationOrigin,
  APPLICATION_ORIGIN_LABELS,
  APPLICATION_STATUS_LABELS
} from "@mikro/common";
import { ListCommand } from "../../ListCommand.js";
import errorHandler from "../../errorHandler.js";
import { cliuiCells, cliuiTableWidth, computeColumnWidths } from "../../lib/cliTableLayout.js";

export default class List extends ListCommand<typeof List> {
  static override readonly description = "display loan applications";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --status RECEIVED",
    "<%= config.bin %> <%= command.id %> --origin ad"
  ];
  static override readonly flags = {
    status: Flags.string({
      description: "Filter by status",
      required: false,
      options: [...applicationStatusEnum.options]
    }),
    origin: Flags.string({
      description: "Filter by origin (web form from an ad or organic, WhatsApp, or manual)",
      required: false,
      options: [...applicationOriginEnum.options]
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(List);
    const client = this.createClient();

    try {
      const apps = await client.listApplications.query({
        status: flags.status as (typeof applicationStatusEnum.options)[number] | undefined,
        origin: flags.origin as (typeof applicationOriginEnum.options)[number] | undefined,
        limit: flags["page-size"],
        offset: flags.offset
      });

      const headers = ["ID", "NAME", "PHONE", "STATUS", "ORIGIN", "SCORE", "CREATED"];
      const rows = apps.map((a) => {
        return [
          a.id,
          [a.firstName, a.lastName].filter(Boolean).join(" ") || "",
          a.phone ?? "",
          APPLICATION_STATUS_LABELS[a.status] ?? a.status,
          APPLICATION_ORIGIN_LABELS[applicationOrigin(a)],
          a.score == null ? "" : String(a.score),
          new Date(a.createdAt).toISOString().slice(0, 10)
        ];
      });
      const widths = computeColumnWidths({
        headers,
        rows,
        minWidths: [undefined, undefined, undefined, 10, 14, 6, undefined],
        maxWidths: [undefined, undefined, undefined, undefined, undefined, undefined, undefined]
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
