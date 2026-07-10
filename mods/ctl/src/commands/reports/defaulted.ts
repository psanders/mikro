/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

export default class Defaulted extends BaseCommand<typeof Defaulted> {
  static override readonly description =
    "generate the at-risk loans report (defaulted + late with 3+ missed) as JSON or a branded PDF — same report definition the dashboard uses";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --filter defaulted",
    "<%= config.bin %> <%= command.id %> --format json",
    "<%= config.bin %> <%= command.id %> --output prestamos-en-riesgo.pdf"
  ];

  static override readonly flags = {
    filter: Flags.string({
      char: "f",
      description: "Filter: all (default), defaulted, or late",
      options: ["all", "defaulted", "late"],
      default: "all"
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
    const { flags } = await this.parse(Defaulted);
    const format = flags.format as "json" | "pdf";

    const date = new Date().toISOString().slice(0, 10);
    const defaultExt = format === "json" ? "json" : "pdf";
    const outputPath = flags.output
      ? resolve(flags.output)
      : resolve(`./prestamos-en-riesgo-${date}.${defaultExt}`);

    try {
      const client = this.createClient();
      this.log("Generando reporte de préstamos en riesgo...");

      const result = await client.generateDefaultedReport.mutate({
        filter: flags.filter as "all" | "defaulted" | "late",
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
