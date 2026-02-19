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
    "generate the defaulted loans report (name, phone, loanId, cycle, paid, AI summary of notes) as PNG";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --output mikro-defaulted-report.png"
  ];

  static override readonly flags = {
    output: Flags.string({
      char: "o",
      description: "Output file path (default: mikro-defaulted-report.png)",
      default: ""
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Defaulted);

    const outputPath = flags.output
      ? resolve(flags.output)
      : resolve("./mikro-defaulted-report.png");

    try {
      const client = this.createClient();
      this.log("Generating defaulted report...");

      const result = await client.generateDefaultedReport.mutate({});

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
