/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";
import { BaseCommand, parseDateRange } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

export default class Performance extends BaseCommand<typeof Performance> {
  static override readonly description =
    "generate a performance report (Loans Issued, Collection Status, Financial Summary, narrative) as PNG with graphics";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --start-date 2026-01-01 --end-date 2026-02-28",
    "<%= config.bin %> <%= command.id %> --output report.png"
  ];

  static override readonly flags = {
    "start-date": Flags.string({
      description: "Start of report period (default: first day of current year, YTD)"
    }),
    "end-date": Flags.string({
      description: "End of report period (default: today)"
    }),
    output: Flags.string({
      char: "o",
      description: "Output file path (default: PNG image)",
      default: ""
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Performance);

    const end = flags["end-date"] ? new Date(flags["end-date"]) : new Date();
    const start = flags["start-date"]
      ? new Date(flags["start-date"])
      : new Date(end.getFullYear(), 0, 1, 0, 0, 0, 0);
    const { endDate, startDateStr, endDateStr } = parseDateRange(
      start.toISOString().slice(0, 10),
      end.toISOString().slice(0, 10)
    );

    const defaultExt = "png";
    const outputPath = flags.output
      ? resolve(flags.output)
      : resolve(`./mikro-performance-report-${endDate.getFullYear()}-YTD.${defaultExt}`);

    try {
      const client = this.createClient();
      this.log("Generating performance report...");
      this.log(`  Period: ${startDateStr} to ${endDateStr}`);

      const result = await client.generatePerformanceReport.mutate({
        startDate: startDateStr,
        endDate: endDateStr
      });

      const dir = resolve(outputPath, "..");
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(outputPath, Buffer.from(result.image, "base64"));
      this.log(`\nReport saved: ${outputPath}`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
