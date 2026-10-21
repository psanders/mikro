/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import { readFileSync } from "fs";
import { basename, resolve } from "path";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";

export default class RenewSign extends MutationCommand<typeof RenewSign> {
  static override readonly description =
    "attach the signed contract (PDF) to a renewal, which makes it ready to finalize";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <renewalId> --file ./contrato-firmado.pdf"
  ];
  static override readonly args = {
    renewalId: Args.string({ description: "Renewal ID", required: true })
  };
  static override readonly flags = {
    file: Flags.string({ description: "Path to the signed contract PDF", required: true })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(RenewSign);
    const client = this.createClient();
    try {
      const path = resolve(flags.file);
      const renewal = await client.uploadRenewalSignedContract.mutate({
        id: args.renewalId,
        originalName: basename(path),
        mimeType: "application/pdf",
        dataBase64: readFileSync(path).toString("base64")
      });
      this.log(`Signed contract attached. Status: ${renewal.status}`);
      this.log(`Next: mikro loans:renewFinalize ${renewal.id}`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
