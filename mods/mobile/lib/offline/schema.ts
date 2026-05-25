/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { SQLiteDatabase } from "expo-sqlite";

const MIGRATION_V1 = `
CREATE TABLE IF NOT EXISTS sync_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  nickname              TEXT,
  phone                 TEXT NOT NULL,
  id_number             TEXT NOT NULL,
  collection_point      TEXT,
  home_address          TEXT NOT NULL,
  preferred_payment_day TEXT,
  is_active             INTEGER NOT NULL DEFAULT 1,
  created_at            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS loans (
  id                TEXT PRIMARY KEY,
  loan_id           INTEGER NOT NULL UNIQUE,
  status            TEXT NOT NULL DEFAULT 'ACTIVE',
  principal         REAL NOT NULL,
  term_length       INTEGER NOT NULL,
  payment_amount    REAL NOT NULL,
  payment_frequency TEXT NOT NULL,
  mora_rate         REAL,
  starting_date     TEXT,
  nickname          TEXT,
  customer_id       TEXT NOT NULL REFERENCES customers(id),
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id                TEXT PRIMARY KEY,
  amount            REAL NOT NULL,
  paid_at           TEXT NOT NULL,
  method            TEXT NOT NULL DEFAULT 'CASH',
  status            TEXT NOT NULL DEFAULT 'COMPLETED',
  kind              TEXT NOT NULL DEFAULT 'INSTALLMENT',
  linked_payment_id TEXT,
  notes             TEXT,
  loan_id           TEXT NOT NULL REFERENCES loans(id),
  collected_by_id   TEXT NOT NULL,
  created_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS loan_notes (
  id            TEXT PRIMARY KEY,
  content       TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  loan_id       TEXT NOT NULL REFERENCES loans(id),
  created_by_id TEXT NOT NULL,
  created_by    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_mutations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL,
  payload     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  status      TEXT NOT NULL DEFAULT 'pending',
  error       TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_loans_customer_id ON loans(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_loan_id ON payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_payments_kind ON payments(kind);
CREATE INDEX IF NOT EXISTS idx_loan_notes_loan_id ON loan_notes(loan_id);
CREATE INDEX IF NOT EXISTS idx_pending_mutations_status ON pending_mutations(status);
`;

const MIGRATIONS = [MIGRATION_V1];

export function runMigrations(db: SQLiteDatabase): void {
  const result = db.getFirstSync<{ user_version: number }>("PRAGMA user_version");
  const currentVersion = result?.user_version ?? 0;

  for (let i = currentVersion; i < MIGRATIONS.length; i++) {
    db.execSync(MIGRATIONS[i]);
  }

  if (currentVersion < MIGRATIONS.length) {
    db.execSync(`PRAGMA user_version = ${MIGRATIONS.length}`);
  }
}
