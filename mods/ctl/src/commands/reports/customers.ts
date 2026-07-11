/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Migrated to the shared `customersReport` definition (issue #110 / Phase E of
 * unify-reporting-strategy): JSON or a branded PDF, same report the dashboard
 * downloads. The pre-migration Excel/CSV/PNG export (with collector-id
 * filtering) is retired per the reporting spec's "no PNG/Excel report output"
 * requirement — `exportCollectorCustomers`/`exportAllCustomers` remain
 * available directly via tRPC for any caller that still needs raw rows.
 */
import { Flags } from "@oclif/core";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";
import { BaseCommand } from "../../BaseCommand.js";
import { localDateString } from "../../lib/dates.js";
import errorHandler from "../../errorHandler.js";

export default class ReportsCustomers extends BaseCommand<typeof ReportsCustomers> {
  static override readonly description =
    "generate the customers report (active customers' loans grouped by payment health) as JSON or a branded PDF — same report definition the dashboard uses";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --format json",
    "<%= config.bin %> <%= command.id %> --output clientes.pdf"
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
    const { flags } = await this.parse(ReportsCustomers);
    const format = flags.format as "json" | "pdf";

    const date = localDateString();
    const defaultExt = format === "json" ? "json" : "pdf";
    const outputPath = flags.output
      ? resolve(flags.output)
      : resolve(`./clientes-${date}.${defaultExt}`);

    try {
      const client = this.createClient();
      this.log("Generando reporte de clientes...");

      const result = await client.generateCustomersReport.mutate({ format });

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
