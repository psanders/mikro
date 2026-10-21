/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";

export default class RenewContract extends MutationCommand<typeof RenewContract> {
  static override readonly description =
    "generate the new loan's contract for a renewal, from the renewal's stored terms";
  static override readonly examples = ["<%= config.bin %> <%= command.id %> <renewalId>"];
  static override readonly args = {
    renewalId: Args.string({ description: "Renewal ID", required: true })
  };
  static override readonly flags = {
    output: Flags.string({
      description: "Directory to write the contract PDF to",
      default: "./output"
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(RenewContract);
    const client = this.createClient();
    try {
      const { renewal, contract } = await client.generateRenewalContract.mutate({
        id: args.renewalId
      });
      const outputDir = resolve(flags.output);
      if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
      const pdfPath = join(outputDir, contract.filename);
      writeFileSync(pdfPath, Buffer.from(contract.dataBase64, "base64"));
      this.log(`Contract saved: ${pdfPath}`);
      this.log(`Status: ${renewal.status}`);
      this.log(
        `Next: have it signed, then mikro loans:renewSign ${renewal.id} --file <signed.pdf>`
      );
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
