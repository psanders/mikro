/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import { MutationCommand } from "../../MutationCommand.js";
import errorHandler from "../../errorHandler.js";

const PAGE_SIZE = 100;
const CLEANABLE_STATUSES = ["DRAFT", "ABANDONED"] as const;
type CleanableStatus = (typeof CLEANABLE_STATUSES)[number];

export default class Cleanup extends MutationCommand<typeof Cleanup> {
  static override readonly description =
    "delete DRAFT and ABANDONED applications with no activity in the last N hours (each recoverable for 30 days via the founder feed's restore)";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --older-than 72",
    "<%= config.bin %> <%= command.id %> --status ABANDONED",
    "<%= config.bin %> <%= command.id %> --dry-run"
  ];
  static override readonly flags = {
    status: Flags.string({
      description: "Only clean up this status (repeatable; default: DRAFT and ABANDONED)",
      options: [...CLEANABLE_STATUSES],
      multiple: true
    }),
    "older-than": Flags.integer({
      description: "Only applications not updated within this many hours",
      default: 24,
      min: 1
    }),
    "dry-run": Flags.boolean({
      description: "List what would be deleted without deleting anything",
      default: false
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Cleanup);
    const client = this.createClient();
    const cutoff = new Date(Date.now() - flags["older-than"] * 60 * 60 * 1000);
    const statuses = (flags.status ?? CLEANABLE_STATUSES) as readonly CleanableStatus[];
    const label = statuses.join("/");

    try {
      // Collect every stale application before deleting any, so deletes don't
      // shift the offsets of pages we haven't read yet.
      const stale: Array<{
        id: string;
        status: string;
        name: string;
        phone: string;
        updatedAt: Date;
      }> = [];
      for (const status of statuses) {
        for (let offset = 0; ; offset += PAGE_SIZE) {
          const page = await client.listApplications.query({ status, limit: PAGE_SIZE, offset });
          for (const a of page) {
            const updatedAt = new Date(a.updatedAt);
            if (updatedAt < cutoff) {
              stale.push({
                id: a.id,
                status: a.status,
                name: [a.firstName, a.lastName].filter(Boolean).join(" "),
                phone: a.phone ?? "",
                updatedAt
              });
            }
          }
          if (page.length < PAGE_SIZE) break;
        }
      }

      if (stale.length === 0) {
        this.log(`No ${label} applications older than ${flags["older-than"]}h.`);
        return;
      }

      for (const a of stale) {
        this.log(
          `${a.id}  ${a.status.padEnd(9)}  ${a.name || "(sin nombre)"}  ${a.phone}  last update ${a.updatedAt.toISOString()}`
        );
      }

      if (flags["dry-run"]) {
        this.log(`\n${stale.length} application(s) would be deleted.`);
        return;
      }

      const ready = await this.confirmOrAbort(
        `Delete ${stale.length} ${label} application(s) older than ${flags["older-than"]}h? Each can be restored within 30 days from the founder feed.`
      );
      if (!ready) return;

      let deleted = 0;
      for (const a of stale) {
        try {
          await client.deleteApplication.mutate({ id: a.id });
          deleted++;
        } catch (e) {
          // Keep going: one that changed state (or vanished) shouldn't abort the rest.
          this.warn(`Failed to delete ${a.id}: ${(e as Error).message}`);
        }
      }
      this.log(`Deleted ${deleted} of ${stale.length} application(s).`);
    } catch (e) {
      errorHandler(e, this.error.bind(this));
    }
  }
}
