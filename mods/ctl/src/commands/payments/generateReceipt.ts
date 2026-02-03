/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { createGenerateReceiptFromData, type GenerateReceiptResponse } from "@mikro/common";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import { promptTextIfMissing, promptNumberIfMissing } from "../../lib/prompts.js";

export default class GenerateReceipt extends BaseCommand<typeof GenerateReceipt> {
  static override readonly description = "generate a payment receipt as an image";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> --payment-id 123e4567-e89b-12d3-a456-426614174000",
    "<%= config.bin %> <%= command.id %> --payment-id 123e4567-e89b-12d3-a456-426614174000 --output ./receipts",
    "<%= config.bin %> <%= command.id %> --interactive"
  ];

  static override readonly flags = {
    "payment-id": Flags.string({
      description: "Payment ID to generate receipt for (omit when using --interactive)"
    }),
    interactive: Flags.boolean({
      char: "i",
      description: "Manually enter receipt data (no API, no database)",
      default: false
    }),
    output: Flags.string({
      char: "o",
      description: "Output directory for generated files",
      default: "./output"
    })
  };

  public async run(): Promise<void> {
    const outputDir = resolve(this.flags.output);

    this.log("Mikro Receipt Generator");
    this.log("=======================\n");

    try {
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      let result: GenerateReceiptResponse;

      if (this.flags.interactive) {
        result = await this.runInteractive();
      } else {
        result = await this.runFromPaymentId(outputDir);
      }

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
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }

  private async runInteractive(): Promise<GenerateReceiptResponse> {
    if (!process.stdout.isTTY) {
      this.error(
        "Interactive mode requires a TTY. Run without --interactive and use --payment-id instead."
      );
    }

    this.log("Enter receipt details (no database). Press ^C to cancel.\n");

    const loanNumber = await promptTextIfMissing(undefined, "Loan number", "loan-number");
    const name = await promptTextIfMissing(undefined, "Member name", "name");
    const date = await promptTextIfMissing(undefined, "Date (DD/MM/YYYY)", "date", {
      default: new Date().toLocaleDateString("es-DO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      })
    });
    const amount = await promptNumberIfMissing(undefined, "Amount (e.g. 500)", "amount");
    const amountPaid = `RD$ ${amount.toLocaleString("es-DO")}`;
    const paymentNumber = await promptTextIfMissing(
      undefined,
      "Payment number (e.g. P1)",
      "payment-number"
    );
    const pendingPayments = await promptNumberIfMissing(
      undefined,
      "Pending payments (number remaining)",
      "pending-payments"
    );
    const agentName = await promptTextIfMissing(
      undefined,
      "Agent name (optional; leave empty to skip)",
      "agent-name",
      { required: false, default: "" }
    );

    const keysDir = process.env.MIKRO_KEYS_PATH || resolve(process.cwd(), ".keys");
    const assetsDir =
      process.env.MIKRO_ASSETS_PATH || resolve(process.cwd(), "mods", "apiserver", "assets");

    const generateReceipt = createGenerateReceiptFromData({ keysDir, assetsDir });
    const receiptData = {
      loanNumber,
      name,
      date,
      amountPaid,
      paymentNumber,
      pendingPayments,
      ...(agentName ? { agentName } : {})
    };

    this.log("\nGenerating receipt...");
    return generateReceipt(receiptData);
  }

  private async runFromPaymentId(outputDir: string): Promise<GenerateReceiptResponse> {
    const paymentId = this.flags["payment-id"];
    if (!paymentId) {
      this.error("Missing required flag: --payment-id (or use --interactive for manual entry)");
    }

    const client = this.createClient();
    this.log(`Generating receipt for payment: ${paymentId}`);
    this.log(`Output directory: ${outputDir}\n`);
    this.log("Calling API to generate receipt...");
    const result = await client.generateReceipt.mutate({ paymentId });
    this.log("Receipt generated successfully!\n");
    return result;
  }
}
