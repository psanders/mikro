/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { TRPCClient } from "@trpc/client";
import type { AppRouter } from "@mikro/apiserver";
import { getDatabase } from "./database";

type ApiClient = TRPCClient<AppRouter>;

const MAX_AUTO_RETRIES = 5;

export interface PushSyncResult {
  succeeded: number;
  failed: number;
}

interface PendingMutationRow {
  id: number;
  type: string;
  payload: string;
  retry_count: number;
}

export async function pushSync(api: ApiClient): Promise<PushSyncResult> {
  const db = getDatabase();
  const rows = db.getAllSync<PendingMutationRow>(
    `SELECT id, type, payload, retry_count FROM pending_mutations
     WHERE status IN ('pending', 'failed') AND retry_count < ?
     ORDER BY id ASC`,
    [MAX_AUTO_RETRIES]
  );

  let succeeded = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      db.runSync("UPDATE pending_mutations SET status = 'syncing' WHERE id = ?", [row.id]);
      const payload = JSON.parse(row.payload);

      if (row.type === "createPayment") {
        await api.createPayment.mutate(payload);
      } else if (row.type === "createLoanNote") {
        await api.createLoanNote.mutate(payload);
      }

      db.runSync("DELETE FROM pending_mutations WHERE id = ?", [row.id]);
      db.runSync("DELETE FROM payments WHERE id = ?", [`pending_${row.id}`]);
      succeeded++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      // A duplicate rejection means the payment is already recorded on the
      // server (e.g. the original push succeeded but the response was lost, then
      // this retry fired). Treat it as done so it doesn't loop or surface as a
      // false failure — the post-push pull will bring the canonical row down.
      if (message.includes("DUPLICATE_PAYMENT")) {
        db.runSync("DELETE FROM pending_mutations WHERE id = ?", [row.id]);
        db.runSync("DELETE FROM payments WHERE id = ?", [`pending_${row.id}`]);
        succeeded++;
        continue;
      }
      db.runSync(
        "UPDATE pending_mutations SET status = 'failed', error = ?, retry_count = retry_count + 1 WHERE id = ?",
        [message, row.id]
      );
      failed++;
    }
  }

  return { succeeded, failed };
}
