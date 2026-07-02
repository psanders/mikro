/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args } from "@oclif/core";
import cliui from "cliui";
import moment from "moment";
import { formatMoney, BUSINESS_TYPE_LABELS, PROVINCE_LABELS } from "@mikro/common";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import { promptApplicationSelectIfMissing } from "../../lib/prompts.js";

export default class Get extends BaseCommand<typeof Get> {
  static override readonly description = "retrieve details of a loan application by ID";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <applicationId>",
    "<%= config.bin %> <%= command.id %>"
  ];
  static override readonly args = {
    applicationId: Args.string({
      description: "The application ID to show details about",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(Get);
    const client = this.createClient();

    const applicationId = await promptApplicationSelectIfMissing(
      client,
      args.applicationId,
      "Application",
      "applicationId"
    );

    try {
      const app = await client.getApplication.query({ id: applicationId });

      if (!app) {
        this.error("Application not found.");
        return;
      }

      const raw = (app.rawData as Record<string, unknown> | null) ?? {};
      const str = (key: string): string => {
        const v = raw[key];
        return typeof v === "string" && v.trim() ? v.trim() : "";
      };

      const ui = cliui({ width: 200 });
      ui.div(
        "APPLICATION DETAILS\n" +
          "--------------\n" +
          `ID: \t${app.id}\n` +
          `SESSION ID: \t${app.sessionId}\n` +
          `STATUS: \t${app.status}\n` +
          `SOURCE: \t${app.source}\n` +
          `\n` +
          `NAME: \t${[app.firstName, app.lastName].filter(Boolean).join(" ") || "N/A"}\n` +
          `PHONE: \t${app.phone ?? "N/A"}\n` +
          `ID NUMBER: \t${app.idNumber ?? "N/A"}\n` +
          `DATE OF BIRTH: \t${app.dateOfBirth ? moment(app.dateOfBirth).format("YYYY-MM-DD") : "N/A"}\n` +
          `MARITAL STATUS: \t${app.maritalStatus ?? "N/A"}\n` +
          `\n` +
          `BUSINESS TYPE: \t${app.businessType ? (BUSINESS_TYPE_LABELS[app.businessType] ?? app.businessType) : "N/A"}\n` +
          `BUSINESS NAME: \t${app.businessName ?? "N/A"}\n` +
          `BUSINESS AGE: \t${str("businessAge") || "N/A"}\n` +
          `MONTHLY SALES: \t${str("monthlySales") || "N/A"}\n` +
          `\n` +
          `REQUESTED AMOUNT: \t${app.requestedAmount == null ? "N/A" : formatMoney(app.requestedAmount)}\n` +
          `PURPOSE: \t${app.purpose ?? "N/A"}\n` +
          `TERM (WEEKS): \t${app.requestedTermWeeks ?? "N/A"}\n` +
          `\n` +
          `PROVINCE: \t${app.province ? (PROVINCE_LABELS[app.province] ?? app.province) : "N/A"}\n` +
          `HOME ADDRESS: \t${app.homeAddress ?? "N/A"}\n` +
          `\n` +
          `SCORE: \t${app.score ?? "N/A"}\n` +
          `RISK BAND: \t${app.riskBand ?? "N/A"}\n` +
          `RECOMMENDATION: \t${app.recommendation ?? "N/A"}\n` +
          `\n` +
          `REVIEWED BY: \t${app.reviewedById ?? "N/A"}\n` +
          `REVIEW NOTE: \t${app.reviewNote ?? "N/A"}\n` +
          `\n` +
          `CÉDULA FRONT: \t${app.idFrontFilename ? "Uploaded" : "Not uploaded"}\n` +
          `CÉDULA BACK: \t${app.idBackFilename ? "Uploaded" : "Not uploaded"}\n` +
          `CONTRACT: \t${app.contractFilename ? "Signed" : "Not signed"}\n` +
          `\n` +
          `CUSTOMER ID: \t${app.customerId ?? "N/A"}\n` +
          `LOAN ID: \t${app.loanId ?? "N/A"}\n` +
          `\n` +
          `SUBMITTED: \t${app.submittedAt ? moment(app.submittedAt).format("YYYY-MM-DD HH:mm:ss") : "N/A"}\n` +
          `CREATED: \t${moment(app.createdAt).format("YYYY-MM-DD HH:mm:ss")}\n` +
          `UPDATED: \t${moment(app.updatedAt).format("YYYY-MM-DD HH:mm:ss")}`
      );

      this.log(ui.toString());
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
