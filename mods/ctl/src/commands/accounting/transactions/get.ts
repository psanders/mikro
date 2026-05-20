/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { formatMoney } from "@mikro/common";
import { Args, Flags } from "@oclif/core";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import moment from "moment";
import { BaseCommand } from "../../../BaseCommand.js";
import errorHandler from "../../../errorHandler.js";
import { promptTransactionSelectIfMissing } from "../../../lib/prompts.js";

export default class Get extends BaseCommand<typeof Get> {
  static override readonly description =
    "show a single accounting transaction, its attachments, and optionally save them to disk";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> <transactionId> --save-attachments ./receipts"
  ];
  static override readonly args = {
    transactionId: Args.string({
      description: "Transaction ID",
      required: false
    })
  };
  static override readonly flags = {
    "save-attachments": Flags.string({
      description: "Directory to save attachments to",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Get);
    const client = this.createClient();

    const id = await promptTransactionSelectIfMissing(
      client,
      args.transactionId,
      "Transaction",
      "transactionId"
    );

    try {
      const txn = await client.accounting.getTransaction.query({ id });
      if (!txn) {
        this.error(`Transaction not found: ${id}`);
        return;
      }

      this.log("");
      this.log(`Transaction ${txn.id}`);
      this.log("-".repeat(60));
      this.log(`  Date: ${moment(txn.occurredAt).format("YYYY-MM-DD")}`);
      this.log(`  Type: ${txn.type}`);
      this.log(`  Status: ${txn.status}`);
      this.log(`  Account: ${txn.account.name}`);
      if (txn.toAccount) this.log(`  To Account: ${txn.toAccount.name}`);
      if (txn.category) this.log(`  Category: ${txn.category.name}`);
      this.log(`  Amount: ${formatMoney(txn.amount)}`);
      this.log(`  Vendor: ${txn.vendor ?? "-"}`);
      this.log(`  Description: ${txn.description ?? "-"}`);
      this.log(`  Reference: ${txn.reference ?? "-"}`);
      this.log(`  Created by: ${txn.createdBy.name}`);
      if (txn.reversalOfId) this.log(`  Reversal of: ${txn.reversalOfId}`);
      this.log(`  Attachments: ${txn.attachments.length}`);

      if (txn.attachments.length > 0) {
        this.log("");
        this.log("Attachments:");
        for (const a of txn.attachments) {
          this.log(
            `  - ${a.id}  ${a.originalName ?? a.filename}  (${a.mimeType}, ${a.size} bytes)`
          );
        }
      }

      const saveDir = flags["save-attachments"];
      if (saveDir && txn.attachments.length > 0) {
        if (!existsSync(saveDir)) mkdirSync(saveDir, { recursive: true });
        for (const a of txn.attachments) {
          const payload = await client.accounting.getTransactionAttachment.query({ id: a.id });
          const outPath = join(saveDir, payload.originalName ?? payload.filename);
          writeFileSync(outPath, Buffer.from(payload.dataBase64, "base64"));
          this.log(`  saved: ${outPath}`);
        }
      }
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
