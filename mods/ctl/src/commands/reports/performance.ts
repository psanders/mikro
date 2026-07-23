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
    "generate the over-time performance report (Desempeño en el Tiempo) as JSON or a branded PDF — the same report definition the dashboard uses";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --end-date 2026-07-31 --months 12",
    "<%= config.bin %> <%= command.id %> --format json",
    "<%= config.bin %> <%= command.id %> --output desempeno-tiempo.pdf"
  ];

  static override readonly flags = {
    "end-date": Flags.string({
      description: "As-of end of the window (default: today)"
    }),
    months: Flags.integer({
      description: "Number of trailing monthly snapshots (2–24)",
      default: 12
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

    if (flags["end-date"]) validateDate(flags["end-date"]);

    const end = flags["end-date"] ? parseDateOnly(flags["end-date"]) : new Date();
    const endDateStr = localDateString(end);

    const date = localDateString();
    const defaultExt = format === "json" ? "json" : "pdf";
    const outputPath = flags.output
      ? resolve(flags.output)
      : resolve(`./desempeno-tiempo-${date}.${defaultExt}`);

    try {
      const client = this.createClient();
      this.log("Generando reporte de desempeño en el tiempo...");
      this.log(`  Hasta: ${endDateStr} · ${flags.months} meses`);

      const result = await client.generatePerformanceTrendReport.mutate({
        endDate: endDateStr,
        months: flags.months,
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
