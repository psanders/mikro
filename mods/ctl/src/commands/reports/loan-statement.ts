/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

export default class LoanStatement extends BaseCommand<typeof LoanStatement> {
  static override readonly description =
    "generate a loan statement (JSON or branded 2-page PDF) for one loan — same report definition the founder-feed action uses";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> 10036",
    "<%= config.bin %> <%= command.id %> 10036 --format json",
    "<%= config.bin %> <%= command.id %> 10036 --output estado-cuenta.pdf"
  ];

  static override readonly args = {
    loanId: Args.string({
      description: "Loan ID (numeric)",
      required: true
    })
  };

  static override readonly flags = {
    format: Flags.string({
      description: "Output format",
      options: ["json", "pdf"],
      default: "pdf"
    }),
    output: Flags.string({
      char: "o",
      description: "Output file path (default: derived from loan id and format)",
      default: ""
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(LoanStatement);
    const loanId = Number(args.loanId);
    const format = flags.format as "json" | "pdf";

    if (!Number.isInteger(loanId) || loanId <= 0) {
      this.error(`Loan ID must be a positive integer, got: ${args.loanId}`);
      return;
    }

    const date = new Date().toISOString().slice(0, 10);
    const defaultExt = format === "json" ? "json" : "pdf";
    const outputPath = flags.output
      ? resolve(flags.output)
      : resolve(`./estado-cuenta-${loanId}-${date}.${defaultExt}`);

    try {
      const client = this.createClient();
      this.log(`Generando estado de cuenta del préstamo #${loanId}...`);

      const result = await client.generateLoanStatement.mutate({ loanId, format });

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

      this.log(`\nEstado de cuenta guardado: ${outputPath}`);
      this.log(
        `  Verificación: ${result.data.evalReport.passCount}/${result.data.evalReport.results.length} controles superados.`
      );
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
