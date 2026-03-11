/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

export default class Renewal extends BaseCommand<typeof Renewal> {
  static override readonly description =
    "generate the renewal candidates report (near-completion and completed loans with rating and AI candidacy note) as PNG";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --output mikro-renewal-report.png"
  ];

  static override readonly flags = {
    output: Flags.string({
      char: "o",
      description: "Output file path (default: mikro-renewal-report.png)",
      default: ""
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Renewal);

    const outputPath = flags.output ? resolve(flags.output) : resolve("./mikro-renewal-report.png");

    try {
      const client = this.createClient();
      this.log("Generating renewal candidates report...");

      const result = await client.generateRenewalCandidatesReport.mutate({});

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
