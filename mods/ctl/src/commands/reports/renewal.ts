/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";
import { BaseCommand } from "../../BaseCommand.js";
import { localDateString } from "../../lib/dates.js";
import errorHandler from "../../errorHandler.js";

export default class Renewal extends BaseCommand<typeof Renewal> {
  static override readonly description =
    "generate the renewal candidates report (near-completion and completed loans with rating and AI candidacy note) as JSON or a branded PDF — same report definition the dashboard uses";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --format json",
    "<%= config.bin %> <%= command.id %> --output renovacion.pdf"
  ];

  static override readonly flags = {
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
    const { flags } = await this.parse(Renewal);
    const format = flags.format as "json" | "pdf";

    const date = localDateString();
    const defaultExt = format === "json" ? "json" : "pdf";
    const outputPath = flags.output
      ? resolve(flags.output)
      : resolve(`./renovacion-${date}.${defaultExt}`);

    try {
      const client = this.createClient();
      this.log("Generando reporte de renovación...");

      const result = await client.generateRenewalCandidatesReport.mutate({ format });

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
