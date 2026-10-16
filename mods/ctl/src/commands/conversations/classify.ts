/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Label stored WhatsApp CX messages with the decision-model classifier
 * (openspec conversation-state): the intent of each message a person sent
 * (closing, question, opt_out, …). Labels only — it never sends a message,
 * touches Chatwoot or changes an application. `--dry-run` writes nothing.
 */
import { Flags } from "@oclif/core";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";

interface ClassifiedTurn {
  id: number;
  phone: string;
  content: string;
  intent: string;
  confidence: number;
  model: string;
}

export default class ConversationsClassify extends MutationCommand<typeof ConversationsClassify> {
  static override readonly description =
    "label stored WhatsApp CX messages with their intent (decision-model classifier); labels only";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> --since 2026-09-26",
    "<%= config.bin %> <%= command.id %> --since 2026-10-01 --phone +18095551234 --dry-run"
  ];

  static override readonly flags = {
    since: Flags.string({ description: "Start of the window (YYYY-MM-DD)", required: true }),
    phone: Flags.string({ description: "Only this phone (E.164) or WhatsApp user id" }),
    force: Flags.boolean({
      description: "Re-label messages that already have a label",
      default: false
    }),
    "dry-run": Flags.boolean({ description: "Classify and print, write nothing", default: false }),
    limit: Flags.integer({ description: "Most messages to classify", default: 1000 })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ConversationsClassify);
    const client = this.createClient();
    const dryRun = flags["dry-run"];

    if (!dryRun) {
      const ready = await this.confirmOrAbort(
        `Label every unlabeled message since ${flags.since}${flags.phone ? ` from ${flags.phone}` : ""}? Labels only; nothing is sent.`
      );
      if (!ready) return;
    }

    try {
      const result = await client.classifyConversationTurns.mutate({
        since: flags.since,
        ...(flags.phone ? { phone: flags.phone } : {}),
        force: flags.force,
        dryRun,
        limit: flags.limit
      });
      const turns = result.turns as ClassifiedTurn[];
      if (dryRun) {
        for (const t of turns) {
          this.log(
            `${t.phone}  #${t.id}  ${t.intent.padEnd(13)} ${t.confidence.toFixed(2)}  ${t.content.replace(/\s+/g, " ").slice(0, 80)}`
          );
        }
      }
      const counts = new Map<string, number>();
      for (const t of turns) counts.set(t.intent, (counts.get(t.intent) ?? 0) + 1);
      this.log(
        `${dryRun ? "Would label" : "Labeled"} ${result.classified}, skipped ${result.skipped} already labeled, ${result.errors} failed. Cost ≈ $${result.costUsd.toFixed(4)}.`
      );
      this.log(
        [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([intent, n]) => `${intent}: ${n}`)
          .join(" · ")
      );
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
