/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { formatMoney } from "@mikro/common";
import { Args } from "@oclif/core";
import cliui from "cliui";
import moment from "moment";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

export default class Get extends BaseCommand<typeof Get> {
  static override readonly description = "retrieve details of a customer by ID";
  static override readonly examples = ["<%= config.bin %> <%= command.id %> <customerId>"];
  static override readonly args = {
    customerId: Args.string({
      description: "The Customer ID to show details about",
      required: true
    })
  };

  public async run(): Promise<void> {
    const { args } = await this.parse(Get);
    const client = this.createClient();

    try {
      const customer = await client.getCustomer.query({ id: args.customerId });

      if (!customer) {
        this.error("Customer not found.");
        return;
      }

      const ui = cliui({ width: 200 });

      ui.div(
        "CUSTOMER DETAILS\n" +
          "--------------\n" +
          `ID: \t${customer.id}\n` +
          `NAME: \t${customer.name}\n` +
          `NICKNAME: \t${customer.nickname ?? "N/A"}\n` +
          `PHONE: \t${customer.phone}\n` +
          `ID NUMBER: \t${customer.idNumber}\n` +
          `COLLECTION POINT: \t${customer.collectionPoint}\n` +
          `HOME ADDRESS: \t${customer.homeAddress}\n` +
          `JOB POSITION: \t${customer.jobPosition || "N/A"}\n` +
          `INCOME: \t${customer.income == null ? "N/A" : formatMoney(customer.income)}\n` +
          `BUSINESS OWNER: \t${customer.isBusinessOwner ? "Yes" : "No"}\n` +
          `NOTES: \t${customer.notes || ""}\n` +
          `ACTIVE: \t${customer.isActive ? "Yes" : "No"}\n` +
          `NOTIFY COLLECTIONS: \t${customer.notificationPolicy ? (customer.notificationPolicy.collections ? "Yes" : "No") : "N/A"}\n` +
          `NOTIFY PAYMENTS: \t${customer.notificationPolicy ? (customer.notificationPolicy.paymentConfirmations ? "Yes" : "No") : "N/A"}\n` +
          `CREATED: \t${moment(customer.createdAt).format("YYYY-MM-DD HH:mm:ss")}\n` +
          `UPDATED: \t${moment(customer.updatedAt).format("YYYY-MM-DD HH:mm:ss")}`
      );

      this.log(ui.toString());
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
