/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";
import {
  applicationStableFlags,
  applicationFieldFlag,
  parseFieldFlags,
  resolveStableFields
} from "../../lib/applicationFields.js";

export default class Create extends MutationCommand<typeof Create> {
  static override readonly description = "create a new loan application";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --first-name Juan --last-name Perez --phone +18095551234 --send-promo",
    "<%= config.bin %> <%= command.id %> --business-type COLMADO --field monthlySales='RD$50,000 – RD$100,000'"
  ];
  static override readonly flags = {
    ...applicationStableFlags,
    ...applicationFieldFlag,
    "send-promo": Flags.boolean({
      description: "Also send the promo template to the application's phone after creation",
      default: false
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Create);
    const client = this.createClient();

    this.log("This utility will help you create a loan application.");
    this.log("Press ^C at any time to quit.");

    const stablePatch = await resolveStableFields(flags);
    const extraPatch = parseFieldFlags(flags.field);
    const patch = { ...stablePatch, ...extraPatch };

    if (Object.keys(patch).length === 0) {
      this.error("Nothing to create — provide at least one field (flag or interactive prompt).");
      return;
    }

    const ready = await this.confirmOrAbort("Ready to create application?");
    if (!ready) return;

    try {
      const app = await client.createApplication.mutate({
        patch,
        sendPromo: flags["send-promo"]
      });

      this.log("Done!");
      this.log(`Application ID: ${app.id}`);
      if (flags["send-promo"]) {
        if (app.promo?.sent) {
          this.log(`Promo sent. Message ID: ${app.promo.messageId}`);
        } else {
          this.log(`Promo not sent: ${app.promo?.error ?? "unknown error"}`);
        }
      }
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
