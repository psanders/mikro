/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { TRPCClient } from "@trpc/client";
import type { AppRouter } from "@mikro/apiserver";
import { getDatabase } from "./database";

type ApiClient = TRPCClient<AppRouter>;

export interface PullSyncResult {
  customers: number;
  loans: number;
  payments: number;
  loanNotes: number;
}

export async function pullSync(api: ApiClient): Promise<PullSyncResult> {
  const data = await api.collectorSync.query();
  const db = getDatabase();

  db.execSync("PRAGMA foreign_keys = OFF");
  db.withTransactionSync(() => {
    db.runSync("DELETE FROM loan_notes");
    db.runSync("DELETE FROM payments WHERE id NOT LIKE 'pending_%'");
    db.runSync("DELETE FROM loans");
    db.runSync("DELETE FROM customers");

    for (const c of data.customers) {
      db.runSync(
        `INSERT INTO customers (id, name, nickname, phone, id_number, collection_point, home_address, preferred_payment_day, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          c.id,
          c.name,
          c.nickname,
          c.phone,
          c.idNumber,
          c.collectionPoint,
          c.homeAddress,
          c.preferredPaymentDay,
          c.isActive ? 1 : 0,
          c.createdAt
        ]
      );
    }

    for (const l of data.loans) {
      db.runSync(
        `INSERT INTO loans (id, loan_id, status, principal, term_length, payment_amount, payment_frequency, mora_rate, starting_date, nickname, customer_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          l.id,
          l.loanId,
          l.status,
          l.principal,
          l.termLength,
          l.paymentAmount,
          l.paymentFrequency,
          l.moraRate,
          l.startingDate,
          l.nickname,
          l.customerId,
          l.createdAt,
          l.updatedAt
        ]
      );

      for (const p of l.payments) {
        db.runSync(
          `INSERT OR IGNORE INTO payments (id, amount, paid_at, method, status, kind, linked_payment_id, notes, loan_id, collected_by_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            p.id,
            p.amount,
            p.paidAt,
            p.method,
            p.status,
            p.kind,
            p.linkedPaymentId,
            p.notes,
            p.loanId,
            p.collectedById,
            p.createdAt
          ]
        );
      }
    }

    for (const n of data.loanNotes) {
      db.runSync(
        `INSERT INTO loan_notes (id, content, created_at, loan_id, created_by_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [n.id, n.content, n.createdAt, n.loanId, n.createdById, n.createdBy]
      );
    }

    db.runSync("INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('last_pull_at', ?)", [
      data.syncedAt
    ]);
    db.runSync("INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('collector_id', ?)", [
      data.collector.id
    ]);
    db.runSync("INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('collector_name', ?)", [
      data.collector.name
    ]);
    db.runSync("INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('mora_config', ?)", [
      JSON.stringify(data.moraConfig)
    ]);

    reinsertPendingPaymentsAsLocal(db);
  });
  db.execSync("PRAGMA foreign_keys = ON");

  return {
    customers: data.customers.length,
    loans: data.loans.length,
    payments: data.loans.reduce((sum, l) => sum + l.payments.length, 0),
    loanNotes: data.loanNotes.length
  };
}

function reinsertPendingPaymentsAsLocal(db: ReturnType<typeof getDatabase>): void {
  const pending = db.getAllSync<{ id: number; payload: string }>(
    "SELECT id, payload FROM pending_mutations WHERE type = 'createPayment' AND status IN ('pending', 'failed')"
  );

  for (const row of pending) {
    const input = JSON.parse(row.payload) as {
      loanId: number;
      amount: number;
      method?: string;
      collectedById: string;
      kind?: string;
    };

    const loan = db.getFirstSync<{ id: string }>("SELECT id FROM loans WHERE loan_id = ?", [
      input.loanId
    ]);
    if (!loan) continue;

    const tempId = `pending_${row.id}`;
    const existing = db.getFirstSync<{ id: string }>("SELECT id FROM payments WHERE id = ?", [
      tempId
    ]);
    if (existing) continue;

    db.runSync(
      `INSERT INTO payments (id, amount, paid_at, method, status, kind, loan_id, collected_by_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tempId,
        input.amount,
        new Date().toISOString(),
        input.method ?? "CASH",
        "COMPLETED",
        input.kind ?? "INSTALLMENT",
        loan.id,
        input.collectedById,
        new Date().toISOString()
      ]
    );
  }
}
