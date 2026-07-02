/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args } from "@oclif/core";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";
import { promptApplicationSelectIfMissing } from "../../lib/prompts.js";
import {
  applicationStableFlags,
  applicationFieldFlag,
  parseFieldFlags,
  resolveStableFields
} from "../../lib/applicationFields.js";

export default class Update extends MutationCommand<typeof Update> {
  static override readonly description = "modify a loan application's fields";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <applicationId>",
    "<%= config.bin %> <%= command.id %> <applicationId> --requested-amount 60000 --purpose 'Inventario'"
  ];
  static override readonly args = {
    applicationId: Args.string({
      description: "The application ID to update",
      required: false
    })
  };
  static override readonly flags = {
    ...applicationStableFlags,
    ...applicationFieldFlag
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Update);
    const client = this.createClient();

    const applicationId = await promptApplicationSelectIfMissing(
      client,
      args.applicationId,
      "Application to update",
      "applicationId"
    );

    try {
      const app = await client.getApplication.query({ id: applicationId });
      if (!app) {
        this.error("Application not found.");
        return;
      }

      this.log("This utility will help you update a loan application.");
      this.log("Press ^C at any time to quit.");

      const stablePatch = await resolveStableFields(flags, {
        "first-name": app.firstName ?? undefined,
        "last-name": app.lastName ?? undefined,
        phone: app.phone ?? undefined,
        "id-number": app.idNumber ?? undefined,
        "date-of-birth": app.dateOfBirth
          ? new Date(app.dateOfBirth).toISOString().slice(0, 10)
          : undefined,
        "marital-status": app.maritalStatus ?? undefined,
        "business-type": app.businessType ?? undefined,
        "business-name": app.businessName ?? undefined,
        "requested-amount": app.requestedAmount != null ? String(app.requestedAmount) : undefined,
        purpose: app.purpose ?? undefined,
        "requested-term-weeks":
          app.requestedTermWeeks != null ? String(app.requestedTermWeeks) : undefined,
        province: app.province ?? undefined,
        "home-address": app.homeAddress ?? undefined
      });
      const extraPatch = parseFieldFlags(flags.field);
      const patch = { ...stablePatch, ...extraPatch };

      if (Object.keys(patch).length === 0) {
        this.log("No changes.");
        return;
      }

      const ready = await this.confirmOrAbort(`Ready to update application ${applicationId}?`);
      if (!ready) return;

      await client.updateApplication.mutate({ id: applicationId, patch });

      this.log("Done!");
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
