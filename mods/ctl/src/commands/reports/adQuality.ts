/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Lead quality per ad (issue #280). The one report that answers "which ads bring
 * borrowers worth having" instead of "which ads bring the most forms" — the
 * distinction Ads Manager cannot make for us, because the Mikro Score that makes
 * it is deliberately never sent to Meta.
 */
import cliui from "cliui";
import { Flags } from "@oclif/core";
import { BaseCommand, parseDateRange } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import { cliuiCells, cliuiTableWidth, computeColumnWidths } from "../../lib/cliTableLayout.js";

/** Matches the report's default window; used only for the human-readable heading. */
const DEFAULT_WINDOW_DAYS = 14;

interface AdQualityRow {
  adId: string | null;
  adName: string | null;
  leads: number;
  drafts: number;
  lowOrModerate: number;
  highOrVeryHigh: number;
  medianScore: number | null;
  approved: number;
}

export default class ReportsAdQuality extends BaseCommand<typeof ReportsAdQuality> {
  static override readonly enableJsonFlag = true;

  static override readonly description =
    "report lead quality per ad — applications grouped by the ad that produced them, with the risk-band split and median Mikro Score";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --since 2026-09-01 --until 2026-09-15",
    "<%= config.bin %> <%= command.id %> --json"
  ];

  static override readonly flags = {
    since: Flags.string({
      description: `Start of the window (YYYY-MM-DD, default: ${DEFAULT_WINDOW_DAYS} days ago)`
    }),
    until: Flags.string({
      description: "End of the window, inclusive (YYYY-MM-DD, default: today)"
    })
  };

  public async run(): Promise<unknown> {
    const { flags } = await this.parse(ReportsAdQuality);
    const { startDateStr, endDateStr } = parseDateRange(flags.since, flags.until, {
      defaultDays: DEFAULT_WINDOW_DAYS
    });

    try {
      const client = this.createClient();
      const result = await client.generateAdQualityReport.mutate({
        since: startDateStr,
        until: endDateStr
      });
      const data = result.data;

      this.log(`\nCalidad por anuncio — ${data.since} a ${data.until}\n`);

      const headers = ["AD", "LEADS", "LOW/MOD", "HIGH/V.HIGH", "MEDIAN ISC", "APPROVED"];
      const rows = (data.rows as AdQualityRow[]).map((row) => [
        this.label(row),
        String(row.leads),
        String(row.lowOrModerate),
        String(row.highOrVeryHigh),
        row.medianScore === null ? "—" : String(row.medianScore),
        String(row.approved)
      ]);

      const widths = computeColumnWidths({ headers, rows, minWidths: [24] });
      const ui = cliui({ width: cliuiTableWidth(widths) });
      ui.div(...cliuiCells(headers, widths));
      for (const row of rows) ui.div(...cliuiCells(row, widths));
      this.log(ui.toString());

      const { totals } = data;
      this.log(
        `\nTotal: ${totals.leads} leads · ${totals.lowOrModerate} LOW/MOD · ` +
          `${totals.highOrVeryHigh} HIGH/V.HIGH · ${totals.approved} aprobados` +
          (totals.drafts ? ` · ${totals.drafts} sin completar` : "")
      );

      return data;
    } catch (e) {
      errorHandler(e, this.error.bind(this));
      return undefined;
    }
  }

  /**
   * What to call a row. Organic is named as its own bucket so it can never be
   * read as one of the ads; an ad we have an id but no name for shows the id,
   * because "unknown" would hide a live ad.
   */
  private label(row: AdQualityRow): string {
    if (row.adId === null) return "(orgánico / sin anuncio)";
    return row.adName ?? row.adId;
  }
}
