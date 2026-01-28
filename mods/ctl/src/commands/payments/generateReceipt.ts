/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

export default class GenerateReceipt extends BaseCommand<typeof GenerateReceipt> {
  static override readonly description = "generate a payment receipt as an image";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> --payment-id 123e4567-e89b-12d3-a456-426614174000",
    "<%= config.bin %> <%= command.id %> --payment-id 123e4567-e89b-12d3-a456-426614174000 --output ./receipts"
  ];

  static override readonly flags = {
    "payment-id": Flags.string({
      description: "Payment ID to generate receipt for",
      required: true
    }),
    output: Flags.string({
      char: "o",
      description: "Output directory for generated files",
      default: "./output"
    })
  };

  public async run(): Promise<void> {
    const client = this.createClient();

    const paymentId = this.flags["payment-id"];
    const outputDir = resolve(this.flags.output);

    this.log("Mikro Receipt Generator");
    this.log("=======================\n");

    try {
      // Ensure output directory exists
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      this.log(`Generating receipt for payment: ${paymentId}`);
      this.log(`Output directory: ${outputDir}\n`);

      // Call API to generate receipt
      this.log("Calling API to generate receipt...");
      const result = await client.generateReceipt.mutate({ paymentId });

      this.log("Receipt generated successfully!\n");

      // Display receipt data
      this.log("Receipt Data:");
      this.log(`  Loan #: ${result.receiptData.loanNumber}`);
      this.log(`  Name: ${result.receiptData.name}`);
      this.log(`  Date: ${result.receiptData.date}`);
      this.log(`  Amount: ${result.receiptData.amountPaid}`);
      this.log(`  Payment #: ${result.receiptData.paymentNumber}`);
      this.log(`  Pending: ${result.receiptData.pendingPayments}`);
      if (result.receiptData.agentName) {
        this.log(`  Agent: ${result.receiptData.agentName}`);
      }
      this.log("");

      // Save PNG image using loanNumber as filename
      const loanNumber = result.receiptData.loanNumber;
      const pngPath = join(outputDir, `${loanNumber}.png`);
      const pngBuffer = Buffer.from(result.image, "base64");
      writeFileSync(pngPath, pngBuffer);
      this.log(`PNG saved: ${pngPath}`);

      // Save JWT token using loanNumber as filename
      const tokenPath = join(outputDir, `${loanNumber}.jwt`);
      writeFileSync(tokenPath, result.token);
      this.log(`Token saved: ${tokenPath}`);

      this.log("\nDone! Check the output folder for your receipt.");
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
