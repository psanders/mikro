/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import { BaseCommand } from "../../../BaseCommand.js";
import errorHandler from "../../../errorHandler.js";
import { promptSelectIfMissing, promptTextIfMissing } from "../../../lib/prompts.js";

type CategoryKind = "EXPENSE" | "INCOME";

export default class Create extends BaseCommand<typeof Create> {
  static override readonly description = "create a new accounting category (expense or income)";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    '<%= config.bin %> <%= command.id %> --name "Combustible" --kind EXPENSE'
  ];
  static override readonly flags = {
    name: Flags.string({ description: "Category name", required: false }),
    kind: Flags.string({
      description: "Category kind",
      options: ["EXPENSE", "INCOME"],
      required: false
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Create);
    const client = this.createClient();

    this.log("Create a new accounting category. Press ^C at any time to quit.");

    const name = await promptTextIfMissing(flags.name, "Category name", "name");
    const kind = await promptSelectIfMissing<CategoryKind>(
      flags.kind as CategoryKind | undefined,
      "Category kind",
      "kind",
      [
        { name: "Expense", value: "EXPENSE" },
        { name: "Income", value: "INCOME" }
      ],
      { default: "EXPENSE" }
    );

    try {
      const category = await client.accounting.createCategory.mutate({ name, kind });
      this.log("Category created.");
      this.log(`  ID: ${category.id}`);
      this.log(`  Name: ${category.name}`);
      this.log(`  Kind: ${category.kind}`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
