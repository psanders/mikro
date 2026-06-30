/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import { RISK_TAGS, type RiskTag } from "@mikro/common";
import { MutationCommand } from "../../../MutationCommand.js";
import errorHandler from "../../../errorHandler.js";
import { promptCustomerSelectIfMissing, promptSelectIfMissing } from "../../../lib/prompts.js";

export default class TagsSet extends MutationCommand<typeof TagsSet> {
  static override readonly description =
    "set a MANUAL risk: tag on a customer (relationship/consent only — status:/dpd: are computed automatically)";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> <customerId> --tag risk:do_not_contact"
  ];
  static override readonly args = {
    customerId: Args.string({ description: "The Customer ID", required: false })
  };
  static override readonly flags = {
    tag: Flags.string({ description: "Tag to set", options: [...RISK_TAGS], required: false })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(TagsSet);
    const client = this.createClient();

    const customerId = await promptCustomerSelectIfMissing(
      client,
      args.customerId,
      "Customer",
      "customerId"
    );
    const tag = await promptSelectIfMissing<RiskTag>(
      flags.tag as RiskTag | undefined,
      "Tag to set",
      "tag",
      RISK_TAGS.map((t) => ({ name: t, value: t }))
    );

    const ready = await this.confirmOrAbort(`Set ${tag} on customer ${customerId}?`);
    if (!ready) return;

    try {
      await client.setCustomerTag.mutate({ customerId, tag });
      this.log("Done!");
      this.log(`${tag} set on customer ${customerId}.`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
