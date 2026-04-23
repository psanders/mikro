/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { confirm } from "@inquirer/prompts";
import { Flags } from "@oclif/core";
import { existsSync, readFileSync } from "fs";
import { basename, extname } from "path";
import { BaseCommand } from "../../../BaseCommand.js";
import errorHandler from "../../../errorHandler.js";
import {
  promptAccountSelectIfMissing,
  promptCategorySelectIfMissing,
  promptDateIfMissing,
  promptNumberIfMissing,
  promptSelectIfMissing,
  promptTextIfMissing
} from "../../../lib/prompts.js";

type TransactionType = "DEPOSIT" | "WITHDRAWAL" | "EXPENSE" | "INCOME" | "TRANSFER";

const EXT_TO_MIME: Record<string, "image/png" | "image/jpeg" | "application/pdf"> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf"
};

export default class Create extends BaseCommand<typeof Create> {
  static override readonly description =
    "record a new accounting transaction (deposit, withdrawal, expense, income, transfer)";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --type EXPENSE --amount 3450 --attach ./scans/edesur.pdf"
  ];
  static override readonly flags = {
    type: Flags.string({
      description: "Transaction type",
      options: ["DEPOSIT", "WITHDRAWAL", "EXPENSE", "INCOME", "TRANSFER"],
      required: false
    }),
    "account-id": Flags.string({ description: "Source/primary account ID", required: false }),
    "to-account-id": Flags.string({
      description: "Destination account ID (only for TRANSFER)",
      required: false
    }),
    amount: Flags.integer({ description: "Amount (positive)", required: false }),
    "occurred-at": Flags.string({
      description: "Date of the movement (YYYY-MM-DD)",
      required: false
    }),
    description: Flags.string({ description: "Description (optional)", required: false }),
    vendor: Flags.string({ description: "Vendor/payee (optional)", required: false }),
    reference: Flags.string({
      description: "External reference (bank ref, invoice no.)",
      required: false
    }),
    "category-id": Flags.string({
      description: "Category ID (only for EXPENSE or INCOME)",
      required: false
    }),
    attach: Flags.string({
      description: "Path to a receipt image/PDF to attach (repeatable)",
      multiple: true,
      required: false
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Create);
    const client = this.createClient();

    this.log("Record an accounting transaction. Press ^C at any time to quit.");

    const type = await promptSelectIfMissing<TransactionType>(
      flags.type as TransactionType | undefined,
      "Transaction type",
      "type",
      [
        { name: "Expense (money out)", value: "EXPENSE" },
        { name: "Income (money in)", value: "INCOME" },
        { name: "Deposit (bank deposit)", value: "DEPOSIT" },
        { name: "Withdrawal (bank withdrawal)", value: "WITHDRAWAL" },
        { name: "Transfer (between my accounts)", value: "TRANSFER" }
      ],
      { default: "EXPENSE" }
    );

    const accountId = await promptAccountSelectIfMissing(
      client,
      flags["account-id"],
      type === "TRANSFER" ? "Source account" : "Account",
      "account-id"
    );

    let toAccountId: string | undefined;
    if (type === "TRANSFER") {
      toAccountId = await promptAccountSelectIfMissing(
        client,
        flags["to-account-id"],
        "Destination account",
        "to-account-id"
      );
      if (toAccountId === accountId) {
        this.error("Destination account must be different from source account.");
      }
    }

    const amount = await promptNumberIfMissing(flags.amount, "Amount", "amount");
    const occurredAtRaw = await promptDateIfMissing(
      flags["occurred-at"],
      "Date (YYYY-MM-DD)",
      "occurred-at"
    );

    let categoryId: string | undefined;
    if (type === "EXPENSE" || type === "INCOME") {
      categoryId = await promptCategorySelectIfMissing(
        client,
        flags["category-id"],
        "Category",
        "category-id",
        { kind: type, allowNone: true }
      );
    }

    const description = flags.description
      ? flags.description
      : process.stdout.isTTY
        ? await promptTextIfMissing(undefined, "Description (optional)", "description", {
            required: false,
            default: ""
          })
        : undefined;

    const vendor =
      type === "EXPENSE" || type === "INCOME"
        ? flags.vendor
          ? flags.vendor
          : process.stdout.isTTY
            ? await promptTextIfMissing(undefined, "Vendor/payee (optional)", "vendor", {
                required: false,
                default: ""
              })
            : undefined
        : flags.vendor;

    const attachmentPaths = flags.attach ?? [];
    const attachments = attachmentPaths.map((p) => this.readAttachment(p));

    this.log("");
    this.log("Review:");
    this.log(`  Type: ${type}`);
    this.log(`  Amount: ${amount}`);
    this.log(`  Date: ${occurredAtRaw}`);
    if (attachments.length > 0) this.log(`  Attachments: ${attachments.length}`);

    const ready = await confirm({ message: "Record this transaction?", default: true });
    if (!ready) {
      this.log("Aborted!");
      return;
    }

    try {
      const txn = await client.accounting.createTransaction.mutate({
        type,
        accountId,
        ...(toAccountId ? { toAccountId } : {}),
        amount,
        occurredAt: new Date(occurredAtRaw),
        ...(description ? { description } : {}),
        ...(vendor ? { vendor } : {}),
        ...(flags.reference ? { reference: flags.reference } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(attachments.length > 0 ? { attachments } : {})
      });

      this.log("Transaction recorded.");
      this.log(`  ID: ${txn.id}`);
      this.log(`  Type: ${txn.type}`);
      this.log(`  Amount: ${txn.amount}`);
      this.log(`  Account: ${txn.account.name}`);
      if (txn.toAccount) this.log(`  To Account: ${txn.toAccount.name}`);
      if (txn.category) this.log(`  Category: ${txn.category.name}`);
      this.log(`  Attachments: ${txn.attachmentCount}`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }

  private readAttachment(filePath: string): {
    originalName: string;
    mimeType: "image/png" | "image/jpeg" | "application/pdf";
    dataBase64: string;
  } {
    if (!existsSync(filePath)) {
      this.error(`Attachment not found: ${filePath}`);
    }
    const ext = extname(filePath).toLowerCase();
    const mimeType = EXT_TO_MIME[ext];
    if (!mimeType) {
      this.error(`Unsupported attachment type: ${ext}. Allowed: .png, .jpg, .jpeg, .pdf`);
    }
    const buffer = readFileSync(filePath);
    return {
      originalName: basename(filePath),
      mimeType,
      dataBase64: buffer.toString("base64")
    };
  }
}
