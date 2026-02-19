/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { confirm } from "@inquirer/prompts";
import { Flags } from "@oclif/core";
import { BaseCommand } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";
import { promptTextIfMissing, promptNumberIfMissing } from "../../lib/prompts.js";

export default class UpdateNickname extends BaseCommand<typeof UpdateNickname> {
  static override readonly description = "set or clear a loan's nickname";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    '<%= config.bin %> <%= command.id %> --loan-id 10001 --nickname "Tienda Central"'
  ];
  static override readonly flags = {
    "loan-id": Flags.integer({
      description: "Numeric loan ID (e.g. 10000, 10001)",
      required: false
    }),
    nickname: Flags.string({
      description: "Nickname to set (omit to clear)",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(UpdateNickname);
    const client = this.createClient();

    this.log("This utility will update a loan's nickname.");
    this.log("Press ^C at any time to quit.");

    const loanId = await promptNumberIfMissing(
      flags["loan-id"],
      "Loan ID (numeric, e.g. 10001)",
      "loan-id"
    );
    const nicknameStr = await promptTextIfMissing(
      flags.nickname,
      "Nickname (press Enter to clear)",
      "nickname",
      { default: "" }
    );
    const nickname = nicknameStr?.trim() === "" ? null : (nicknameStr?.trim() ?? null);

    const ready = await confirm({
      message:
        nickname !== null
          ? `Set loan #${loanId} nickname to "${nickname}"?`
          : `Clear nickname for loan #${loanId}?`
    });

    if (!ready) {
      this.log("Aborted!");
      return;
    }

    try {
      const result = await client.updateLoanNickname.mutate({ loanId, nickname });
      this.log("Done!");
      this.log(
        result.nickname !== null
          ? `Loan #${result.loanId} nickname set to "${result.nickname}".`
          : `Loan #${result.loanId} nickname cleared.`
      );
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
