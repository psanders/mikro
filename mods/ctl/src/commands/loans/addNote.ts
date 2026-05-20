/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags, Args } from "@oclif/core";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";
import {
  promptTextIfMissing,
  promptUserSelectIfMissing,
  promptLoanSelectIfMissing
} from "../../lib/prompts.js";

export default class AddNote extends MutationCommand<typeof AddNote> {
  static override readonly description =
    "add a note to a loan (for collection follow-up). Records who wrote it and when.";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> 10001 --content 'Cliente prometió pagar el viernes' --user-id <uuid>"
  ];
  static override readonly args = {
    loanId: Args.string({
      description: "Numeric loan ID (e.g. 10001)",
      required: false
    })
  };
  static override readonly flags = {
    content: Flags.string({
      description: "Note content",
      required: false
    }),
    "user-id": Flags.string({
      description: "Your user UUID (who is recording the note)",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(AddNote);
    const client = this.createClient();

    this.log("Add a note to a loan. Press ^C at any time to quit.");

    const loanId = await promptLoanSelectIfMissing(
      client,
      args.loanId,
      "Loan ID (numeric, e.g. 10001)",
      "loanId"
    );
    const content = await promptTextIfMissing(flags.content, "Note content", "content");
    const createdById = await promptUserSelectIfMissing(
      client,
      flags["user-id"],
      "Your user (who is recording the note)",
      "user-id"
    );

    const ready = await this.confirmOrAbort(`Add note to loan #${loanId}?`);
    if (!ready) return;

    try {
      const result = await client.createLoanNote.mutate({
        loanId,
        content,
        createdById
      });
      this.log("Note added.");
      this.log(`  ID: ${result.id}`);
      this.log(`  By: ${result.createdBy}`);
      this.log(`  At: ${result.createdAt}`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
