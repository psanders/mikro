/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";
import { promptTextIfMissing, promptLoanSelectIfMissing } from "../../lib/prompts.js";

export default class UpdateNickname extends MutationCommand<typeof UpdateNickname> {
  static override readonly description = "set or clear a loan's nickname";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    '<%= config.bin %> <%= command.id %> 10001 --nickname "Tienda Central"'
  ];
  static override readonly args = {
    loanId: Args.string({
      description: "Numeric loan ID (e.g. 10000, 10001)",
      required: false
    })
  };
  static override readonly flags = {
    nickname: Flags.string({
      description: "Nickname to set (omit to clear)",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(UpdateNickname);
    const client = this.createClient();

    this.log("This utility will update a loan's nickname.");
    this.log("Press ^C at any time to quit.");

    const loanId = await promptLoanSelectIfMissing(
      client,
      args.loanId,
      "Loan ID (numeric, e.g. 10001)",
      "loanId"
    );
    const nicknameStr = await promptTextIfMissing(
      flags.nickname,
      "Nickname (press Enter to clear)",
      "nickname",
      { default: "" }
    );
    const nickname = nicknameStr?.trim() === "" ? null : (nicknameStr?.trim() ?? null);

    const message =
      nickname !== null
        ? `Set loan #${loanId} nickname to "${nickname}"?`
        : `Clear nickname for loan #${loanId}?`;
    const ready = await this.confirmOrAbort(message);
    if (!ready) return;

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
