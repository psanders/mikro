/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Manual fallback for contract generation: if a loan was created without
 * checking "generar contrato con estos términos" in the founder copilot, or an
 * older loan predates that flow entirely, this regenerates the same PDF via
 * `generateCustomerContract` and saves it to disk. The API call already
 * persists the PDF as a `CustomerDocument` (see customers:documentsList); this
 * command exists to also hand the founder a local copy.
 */
import { Args, Flags } from "@oclif/core";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { MutationCommand } from "../../MutationCommand.js";
import { validateDate } from "../../BaseCommand.js";
import { localDateString } from "../../lib/dates.js";
import errorHandler from "../../errorHandler.js";
import {
  promptCustomerSelectIfMissing,
  promptNumberIfMissing,
  promptSelectIfMissing,
  promptTextIfMissing
} from "../../lib/prompts.js";

export default class GenerateContract extends MutationCommand<typeof GenerateContract> {
  static override readonly description =
    "generate a loan contract PDF for a customer (manual fallback for a loan created without the checkbox)";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> <customerId>",
    "<%= config.bin %> <%= command.id %> <customerId> --output ./contracts"
  ];
  static override readonly args = {
    customerId: Args.string({
      description: "The Customer ID to generate a contract for",
      required: false
    })
  };
  static override readonly flags = {
    output: Flags.string({
      char: "o",
      description: "Output directory for the generated PDF",
      default: "./output"
    }),
    principal: Flags.integer({ description: "Principal Amount", required: false }),
    installments: Flags.integer({
      description: "Number of installments (cuotas)",
      required: false
    }),
    "installment-amount": Flags.integer({
      description: "Installment amount (per period)",
      required: false
    }),
    frequency: Flags.string({
      description: "Payment Frequency",
      options: ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"],
      required: false
    }),
    "start-date": Flags.string({
      description: "First-payment date (ISO date, e.g. 2026-02-15)",
      required: false
    }),
    "marital-status": Flags.string({
      description: "Optional marital status override (e.g. casada)",
      required: false
    }),
    occupation: Flags.string({
      description: "Optional occupation override (defaults to the customer's job position)",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(GenerateContract);
    const client = this.createClient();
    const outputDir = resolve(flags.output);

    const customerId = await promptCustomerSelectIfMissing(
      client,
      args.customerId,
      "Customer",
      "customerId"
    );
    const principal = await promptNumberIfMissing(flags.principal, "Principal Amount", "principal");
    const installments = await promptNumberIfMissing(
      flags.installments,
      "Number of installments (cuotas)",
      "installments"
    );
    const installmentAmount = await promptNumberIfMissing(
      flags["installment-amount"],
      "Installment amount (per period)",
      "installment-amount"
    );
    const frequency = await promptSelectIfMissing(
      flags.frequency as "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | undefined,
      "Payment Frequency",
      "frequency",
      [
        { name: "Daily (Diario)", value: "DAILY" as const },
        { name: "Weekly (Semanal)", value: "WEEKLY" as const },
        { name: "Biweekly (Quincenal)", value: "BIWEEKLY" as const },
        { name: "Monthly (Mensual)", value: "MONTHLY" as const }
      ]
    );
    const today = localDateString();
    const startDate = await promptTextIfMissing(
      flags["start-date"],
      "First-payment date (YYYY-MM-DD)",
      "start-date",
      { default: today }
    );
    validateDate(startDate);
    const maritalStatusStr = await promptTextIfMissing(
      flags["marital-status"],
      "Marital status (optional, press Enter to skip)",
      "marital-status",
      { default: "" }
    );
    const occupationStr = await promptTextIfMissing(
      flags.occupation,
      "Occupation override (optional, press Enter to skip)",
      "occupation",
      { default: "" }
    );

    const ready = await this.confirmOrAbort("Ready to generate this contract?");
    if (!ready) return;

    try {
      if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

      const result = await client.generateCustomerContract.mutate({
        customerId,
        principal,
        installments,
        installmentAmount,
        frequency,
        startDate,
        ...(maritalStatusStr?.trim() && { maritalStatus: maritalStatusStr.trim() }),
        ...(occupationStr?.trim() && { occupation: occupationStr.trim() })
      });

      const pdfPath = join(outputDir, result.filename);
      writeFileSync(pdfPath, Buffer.from(result.dataBase64, "base64"));

      this.log("Done! The contract was also persisted as a CustomerDocument on the customer.");
      this.log(`PDF saved: ${pdfPath}`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
