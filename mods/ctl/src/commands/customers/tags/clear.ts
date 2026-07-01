/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Args, Flags } from "@oclif/core";
import { RISK_TAGS, type RiskTag } from "@mikro/common";
import { MutationCommand } from "../../../MutationCommand.js";
import errorHandler from "../../../errorHandler.js";
import { promptCustomerSelectIfMissing, promptSelectIfMissing } from "../../../lib/prompts.js";

export default class TagsClear extends MutationCommand<typeof TagsClear> {
  static override readonly description = "clear a MANUAL risk: tag from a customer";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> <customerId> --tag risk:do_not_contact"
  ];
  static override readonly args = {
    customerId: Args.string({ description: "The Customer ID", required: false })
  };
  static override readonly flags = {
    tag: Flags.string({ description: "Tag to clear", options: [...RISK_TAGS], required: false })
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(TagsClear);
    const client = this.createClient();

    const customerId = await promptCustomerSelectIfMissing(
      client,
      args.customerId,
      "Customer",
      "customerId"
    );
    const tag = await promptSelectIfMissing<RiskTag>(
      flags.tag as RiskTag | undefined,
      "Tag to clear",
      "tag",
      RISK_TAGS.map((t) => ({ name: t, value: t }))
    );

    const ready = await this.confirmOrAbort(`Clear ${tag} from customer ${customerId}?`);
    if (!ready) return;

    try {
      const result = await client.clearCustomerTag.mutate({ customerId, tag });
      this.log("Done!");
      this.log(result.removed ? `${tag} removed.` : `${tag} was not set on this customer.`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
