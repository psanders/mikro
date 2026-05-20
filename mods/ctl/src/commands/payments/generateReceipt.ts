/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import type { GenerateReceiptResponse } from "@mikro/common";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import { promptPaymentSelectIfMissing } from "../../lib/prompts.js";

export default class GenerateReceipt extends BaseCommand<typeof GenerateReceipt> {
  static override readonly description = "generate a payment receipt as an image";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <paymentId>",
    "<%= config.bin %> <%= command.id %> <paymentId> --output ./receipts"
  ];

  static override readonly args = {
    paymentId: Args.string({
      description: "Payment ID to generate receipt for",
      required: false
    })
  };

  static override readonly flags = {
    output: Flags.string({
      char: "o",
      description: "Output directory for generated files",
      default: "./output"
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(GenerateReceipt);
    const outputDir = resolve(flags.output);
    const client = this.createClient();

    this.log("Mikro Receipt Generator");
    this.log("=======================\n");

    try {
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      const paymentId = await promptPaymentSelectIfMissing(
        client,
        args.paymentId,
        "Payment",
        "paymentId"
      );

      this.log(`Generating receipt for payment: ${paymentId}`);
      this.log(`Output directory: ${outputDir}\n`);
      this.log("Calling API to generate receipt...");
      const result = await client.generateReceipt.mutate({ paymentId });
      this.log("Receipt generated successfully!\n");

      this.writeOutput(result, outputDir);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }

  private writeOutput(result: GenerateReceiptResponse, outputDir: string): void {
    const rd = result.receiptData;
    this.log("Receipt Data:");
    this.log(`  Loan #: ${rd.loanNumber}`);
    this.log(`  Name: ${rd.name}`);
    this.log(`  Date: ${rd.date}`);
    this.log(`  Amount: ${rd.amountPaid}`);
    this.log(`  Payment #: ${rd.paymentNumber}`);
    this.log(`  Pending: ${rd.pendingPayments}`);
    if (rd.agentName) {
      this.log(`  Agent: ${rd.agentName}`);
    }
    this.log("");

    const loanNumber = rd.loanNumber;
    const pngPath = join(outputDir, `${loanNumber}.png`);
    writeFileSync(pngPath, Buffer.from(result.image, "base64"));
    this.log(`PNG saved: ${pngPath}`);

    const tokenPath = join(outputDir, `${loanNumber}.jwt`);
    writeFileSync(tokenPath, result.token);
    this.log(`Token saved: ${tokenPath}`);

    this.log("\nDone! Check the output folder for your receipt.");
  }
}
