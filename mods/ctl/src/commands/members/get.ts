/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args } from "@oclif/core";
import cliui from "cliui";
import moment from "moment";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

export default class Get extends BaseCommand<typeof Get> {
  static override readonly description = "retrieve details of a member by ID";
  static override readonly examples = ["<%= config.bin %> <%= command.id %> <member-id>"];
  static override readonly args = {
    ref: Args.string({
      description: "The Member ID to show details about",
      required: true
    })
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(Get);
    const client = this.createClient();

    try {
      const member = await client.getMember.query({ id: args.ref });

      if (!member) {
        this.error("Member not found.");
        return;
      }

      const ui = cliui({ width: 200 });

      ui.div(
        "MEMBER DETAILS\n" +
          "--------------\n" +
          `ID: \t${member.id}\n` +
          `NAME: \t${member.name}\n` +
          `PHONE: \t${member.phone}\n` +
          `ID NUMBER: \t${member.idNumber}\n` +
          `COLLECTION POINT: \t${member.collectionPoint}\n` +
          `HOME ADDRESS: \t${member.homeAddress}\n` +
          `JOB POSITION: \t${member.jobPosition || "N/A"}\n` +
          `INCOME: \t${member.income || "N/A"}\n` +
          `BUSINESS OWNER: \t${member.isBusinessOwner ? "Yes" : "No"}\n` +
          `NOTES: \t${member.notes || ""}\n` +
          `ACTIVE: \t${member.isActive ? "Yes" : "No"}\n` +
          `CREATED: \t${moment(member.createdAt).format("YYYY-MM-DD HH:mm:ss")}\n` +
          `UPDATED: \t${moment(member.updatedAt).format("YYYY-MM-DD HH:mm:ss")}`
      );

      this.log(ui.toString());
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
