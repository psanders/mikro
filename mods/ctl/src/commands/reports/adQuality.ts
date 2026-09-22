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
import { APPLICATION_SECTION_IDS } from "@mikro/common";
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
  started: number;
  submitRate: number | null;
  medianCompleteness: number | null;
  reachedSection: Record<string, number>;
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

      const headers = [
        "AD",
        "STARTED",
        "LEADS",
        "SUBMIT %",
        "MED. COMPLETENESS",
        "LOW/MOD",
        "HIGH/V.HIGH",
        "MEDIAN ISC",
        "APPROVED"
      ];
      const rows = (data.rows as AdQualityRow[]).map((row) => [
        this.label(row),
        String(row.started),
        String(row.leads),
        this.percent(row.submitRate),
        row.medianCompleteness === null ? "—" : `${row.medianCompleteness}%`,
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
        `\nTotal: ${totals.started} iniciadas · ${totals.leads} leads (${this.percent(totals.submitRate)}) · ` +
          `${totals.lowOrModerate} LOW/MOD · ${totals.highOrVeryHigh} HIGH/V.HIGH · ` +
          `${totals.approved} aprobados` +
          (totals.drafts ? ` · ${totals.drafts} sin completar` : "")
      );

      if (totals.drafts > 0) {
        this.log(`Dónde se detienen los que no completan: ${this.reachedSectionSummary(totals)}`);
      }

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

  /** `null` (nothing started yet) reads as "—", never "0%" — that would read as "terrible". */
  private percent(rate: number | null): string {
    return rate === null ? "—" : `${Math.round(rate * 100)}%`;
  }

  /**
   * Compact "sección N · sección M" summary of the reachedSection histogram,
   * in the form's own section order, skipping sections nobody stopped at. The
   * per-row histogram is still in the JSON (`--json`) output for anyone who
   * wants it broken down by ad.
   */
  private reachedSectionSummary(totals: { reachedSection: Record<string, number> }): string {
    const parts: string[] = [];
    for (const id of APPLICATION_SECTION_IDS) {
      const count = totals.reachedSection[id] ?? 0;
      if (count > 0) parts.push(`${id} ${count}`);
    }
    const none = totals.reachedSection.none ?? 0;
    if (none > 0) parts.push(`sin sección ${none}`);
    return parts.length > 0 ? parts.join(" · ") : "—";
  }
}
