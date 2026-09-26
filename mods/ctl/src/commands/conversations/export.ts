/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Export persisted WhatsApp CX transcripts (issue #299) for agent evals and
 * audits: every guest/prospect/applicant/customer message, every agent reply
 * with the agent's version hash and tool calls, and the app's fixed replies.
 * Writes to stdout so it pipes straight into an eval harness or a file.
 */
import { Flags } from "@oclif/core";
import { AGENT_PROFILES } from "@mikro/common";
import { BaseCommand, parseDateRange } from "../../BaseCommand.js";
import errorHandler from "../../errorHandler.js";

/** Default window when no --since is given. */
const DEFAULT_WINDOW_DAYS = 7;

interface Turn {
  id: number;
  phone: string;
  role: "INBOUND" | "AGENT" | "SYSTEM";
  content: string;
  profile: string | null;
  agentName: string | null;
  agentVersion: string | null;
  toolCalls: Array<{ name: string; args: Record<string, unknown> }>;
  hasImage: boolean;
  applicationId: string | null;
  customerId: string | null;
  createdAt: string | Date;
}

/** One phone's turns, in order, with what an eval needs to slice them. */
function groupByPhone(turns: Turn[]) {
  const byPhone = new Map<string, Turn[]>();
  for (const turn of turns) {
    const list = byPhone.get(turn.phone) ?? [];
    list.push(turn);
    byPhone.set(turn.phone, list);
  }
  return [...byPhone.entries()].map(([phone, list]) => ({
    phone,
    profiles: [...new Set(list.map((t) => t.profile).filter(Boolean))],
    agentVersions: [...new Set(list.map((t) => t.agentVersion).filter(Boolean))],
    startedAt: list[0].createdAt,
    endedAt: list[list.length - 1].createdAt,
    turns: list
  }));
}

function textLine(turn: Turn): string {
  const when = new Date(turn.createdAt).toISOString().replace("T", " ").slice(0, 19);
  const who =
    turn.role === "INBOUND"
      ? "person"
      : turn.role === "AGENT"
        ? `${turn.agentName ?? "agent"}@${turn.agentVersion ?? "?"}`
        : "system";
  const tools = turn.toolCalls.length
    ? `  [tools: ${turn.toolCalls.map((t) => `${t.name}(${JSON.stringify(t.args)})`).join(", ")}]`
    : "";
  return `${when}  ${turn.phone}  ${turn.profile ?? "-"}  ${who}: ${turn.content}${tools}`;
}

export default class ConversationsExport extends BaseCommand<typeof ConversationsExport> {
  static override readonly description =
    "export WhatsApp CX conversation transcripts (for agent evals, drift checks and audits)";

  static override readonly examples = [
    "<%= config.bin %> <%= command.id %> > turns.jsonl",
    "<%= config.bin %> <%= command.id %> --since 2026-09-01 --format conversations > convos.jsonl",
    "<%= config.bin %> <%= command.id %> --profile CUSTOMER --agent-version 3f2a9c1b7d4e",
    "<%= config.bin %> <%= command.id %> --phone +18095551234 --format text"
  ];

  static override readonly flags = {
    since: Flags.string({
      description: `Start of the window (YYYY-MM-DD, default: ${DEFAULT_WINDOW_DAYS} days ago)`
    }),
    until: Flags.string({
      description: "End of the window, inclusive (YYYY-MM-DD, default: today)"
    }),
    phone: Flags.string({ description: "Only this phone's conversation" }),
    application: Flags.string({ description: "Only the conversation behind this application ID" }),
    customer: Flags.string({ description: "Only this customer's conversation (by customer ID)" }),
    profile: Flags.string({
      description: "Only turns served under this profile",
      options: [...AGENT_PROFILES]
    }),
    agent: Flags.string({ description: "Only turns answered by this agent (agents.yaml name)" }),
    "agent-version": Flags.string({ description: "Only turns from this agent version hash" }),
    format: Flags.string({
      description:
        "turns: one JSON turn per line; conversations: one JSON conversation per phone per line; text: human-readable",
      options: ["turns", "conversations", "text"],
      default: "turns"
    }),
    limit: Flags.integer({ description: "Newest N turns in the window (max 10000)", default: 1000 })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ConversationsExport);
    const { startDate, endDate } = parseDateRange(flags.since, flags.until, {
      defaultDays: DEFAULT_WINDOW_DAYS
    });

    try {
      const client = this.createClient();
      const turns = (await client.listConversationTurns.query({
        since: startDate,
        until: endDate,
        limit: flags.limit,
        ...(flags.phone ? { phone: flags.phone } : {}),
        ...(flags.application ? { applicationId: flags.application } : {}),
        ...(flags.customer ? { customerId: flags.customer } : {}),
        ...(flags.profile ? { profile: flags.profile as (typeof AGENT_PROFILES)[number] } : {}),
        ...(flags.agent ? { agentName: flags.agent } : {}),
        ...(flags["agent-version"] ? { agentVersion: flags["agent-version"] } : {})
      })) as Turn[];

      if (flags.format === "text") {
        if (turns.length === 0) this.logToStderr("No conversation turns match.");
        for (const turn of turns) this.log(textLine(turn));
        return;
      }
      const lines = flags.format === "conversations" ? groupByPhone(turns) : turns;
      for (const line of lines) this.log(JSON.stringify(line));
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
