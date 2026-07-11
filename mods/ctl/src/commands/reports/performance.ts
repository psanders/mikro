/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";
import { BaseCommand, validateDate } from "../../BaseCommand.js";
import { localDateString, parseDateOnly } from "../../lib/dates.js";
import errorHandler from "../../errorHandler.js";

export default class Performance extends BaseCommand<typeof Performance> {
  static override readonly description =
    "generate the performance report (metrics + narrative) as JSON or a branded PDF — same report definition the dashboard uses";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --start-date 2026-01-01 --end-date 2026-02-28",
    "<%= config.bin %> <%= command.id %> --format json",
    "<%= config.bin %> <%= command.id %> --output desempeno.pdf"
  ];

  static override readonly flags = {
    "start-date": Flags.string({
      description: "Start of report period (default: first day of current year, YTD)"
    }),
    "end-date": Flags.string({
      description: "End of report period (default: today)"
    }),
    format: Flags.string({
      description: "Output format",
      options: ["json", "pdf"],
      default: "pdf"
    }),
    output: Flags.string({
      char: "o",
      description: "Output file path (default: derived from date and format)",
      default: ""
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Performance);
    const format = flags.format as "json" | "pdf";

    if (flags["start-date"]) validateDate(flags["start-date"]);
    if (flags["end-date"]) validateDate(flags["end-date"]);

    const end = flags["end-date"] ? parseDateOnly(flags["end-date"]) : new Date();
    const start = flags["start-date"]
      ? parseDateOnly(flags["start-date"])
      : new Date(end.getFullYear(), 0, 1, 0, 0, 0, 0);
    const startDateStr = localDateString(start);
    const endDateStr = localDateString(end);

    const date = localDateString();
    const defaultExt = format === "json" ? "json" : "pdf";
    const outputPath = flags.output
      ? resolve(flags.output)
      : resolve(`./desempeno-${date}.${defaultExt}`);

    try {
      const client = this.createClient();
      this.log("Generando reporte de desempeño...");
      this.log(`  Periodo: ${startDateStr} a ${endDateStr}`);

      const result = await client.generatePerformanceReport.mutate({
        startDate: startDateStr,
        endDate: endDateStr,
        format
      });

      const dir = resolve(outputPath, "..");
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      if (format === "json") {
        writeFileSync(outputPath, JSON.stringify(result.data, null, 2));
      } else {
        if (!result.pdfBase64) {
          this.error("El servidor no devolvió el PDF esperado.");
          return;
        }
        writeFileSync(outputPath, Buffer.from(result.pdfBase64, "base64"));
      }

      this.log(`\nReporte guardado: ${outputPath}`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
