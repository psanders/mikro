/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { formatMoney, type GenerateReceiptResponse } from "@mikro/common";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import { promptTextIfMissing, promptNumberIfMissing } from "../../lib/prompts.js";

export default class GenerateReceipt extends BaseCommand<typeof GenerateReceipt> {
  static override readonly description = "generate a payment receipt as an image";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> --payment-id 123e4567-e89b-12d3-a456-426614174000",
    "<%= config.bin %> <%= command.id %> --payment-id 123e4567-e89b-12d3-a456-426614174000 --output ./receipts",
    "<%= config.bin %> <%= command.id %> --manual"
  ];

  static override readonly flags = {
    "payment-id": Flags.string({
      description: "Payment ID to generate receipt for (omit when using --manual)"
    }),
    manual: Flags.boolean({
      char: "m",
      description: "Manually enter receipt data (no database lookup)",
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

      if (this.flags.manual) {
        result = await this.runManual();
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

  private async runManual(): Promise<GenerateReceiptResponse> {
    if (!process.stdout.isTTY) {
      this.error("Manual mode requires a TTY. Run without --manual and use --payment-id instead.");
    }

    this.log("Enter receipt details (no database). Press ^C to cancel.\n");

    const loanNumber = await promptTextIfMissing(undefined, "Loan number", "loan-number");
    const name = await promptTextIfMissing(undefined, "Customer name", "name");
    const date = await promptTextIfMissing(undefined, "Date (DD/MM/YYYY)", "date", {
      default: new Date().toLocaleDateString("es-DO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      })
    });
    const principal = await promptNumberIfMissing(
      undefined,
      "Principal / Capital (e.g. 5000)",
      "principal"
    );
    const principalAmount = `RD$ ${formatMoney(principal)}`;
    const amount = await promptNumberIfMissing(undefined, "Amount paid (e.g. 500)", "amount");
    const amountPaid = `RD$ ${formatMoney(amount)}`;
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
    const fee = await promptNumberIfMissing(
      undefined,
      "Late fee / Mora (enter 0 if none)",
      "late-fee"
    );
    const agentName = await promptTextIfMissing(
      undefined,
      "Agent name (optional; leave empty to skip)",
      "agent-name",
      { required: false, default: "" }
    );

    const feePaid = fee > 0 ? `RD$ ${formatMoney(fee)}` : undefined;
    const totalPaid = fee > 0 ? `RD$ ${formatMoney(amount + fee)}` : undefined;

    const client = this.createClient();

    this.log("\nGenerating receipt via API...");
    return client.generateReceiptFromData.mutate({
      loanNumber,
      name,
      date,
      principalAmount,
      amountPaid,
      paymentNumber,
      pendingPayments,
      ...(agentName ? { agentName } : {}),
      ...(feePaid ? { feePaid } : {}),
      ...(totalPaid ? { totalPaid } : {})
    });
  }

  private async runFromPaymentId(outputDir: string): Promise<GenerateReceiptResponse> {
    const paymentId = this.flags["payment-id"];
    if (!paymentId) {
      this.error("Missing required flag: --payment-id (or use --manual for manual entry)");
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
