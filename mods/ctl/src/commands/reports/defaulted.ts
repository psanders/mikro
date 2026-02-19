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
    "generate the at-risk loans report (defaulted + late with 3+ missed; name, phone, loanId, cycle, paid, estado, AI summary) as PNG";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --output mikro-risk-report.png",
    "<%= config.bin %> <%= command.id %> --filter defaulted"
  ];

  static override readonly flags = {
    output: Flags.string({
      char: "o",
      description: "Output file path (default: mikro-risk-report.png)",
      default: ""
    }),
    filter: Flags.string({
      char: "f",
      description: "Filter: all (default), defaulted, or late",
      options: ["all", "defaulted", "late"],
      default: "all"
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Defaulted);

    const outputPath = flags.output ? resolve(flags.output) : resolve("./mikro-risk-report.png");

    try {
      const client = this.createClient();
      this.log("Generating at-risk report...");

      const result = await client.generateDefaultedReport.mutate({
        filter: flags.filter as "all" | "defaulted" | "late"
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
