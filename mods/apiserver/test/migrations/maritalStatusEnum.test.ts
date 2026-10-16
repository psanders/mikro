/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The marital-status enum migration maps every value prod holds (form labels
 * plus the variants José typed) to a code in the column and in rawData. Codes
 * already there (posted by the new site to the old server) stay untouched, an
 * unrecognized column value becomes NULL (Prisma fails a read on a value
 * outside the enum), and running it twice changes nothing.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { expect } from "chai";
import { MARITAL_STATUSES } from "@mikro/common";

const MIGRATION = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../prisma/migrations/20261016120000_marital_status_enum/migration.sql"
  ),
  "utf-8"
);

// [column/rawData value before, column after, rawData after]
const CASES: Array<[string | null, string | null, string | null]> = [
  ["Soltero(a)", "SOLTERO", "SOLTERO"],
  ["Soltero/a", "SOLTERO", "SOLTERO"],
  ["Soltera", "SOLTERO", "SOLTERO"],
  ["Casado(a)", "CASADO", "CASADO"],
  ["Unión libre", "UNION_LIBRE", "UNION_LIBRE"],
  ["Divorciado(a)", "DIVORCIADO", "DIVORCIADO"],
  ["Viudo(a)", "VIUDO", "VIUDO"],
  // Already codes (the new site reached the old server first): untouched.
  ["SOLTERO", "SOLTERO", "SOLTERO"],
  ["CASADO", "CASADO", "CASADO"],
  ["UNION_LIBRE", "UNION_LIBRE", "UNION_LIBRE"],
  ["DIVORCIADO", "DIVORCIADO", "DIVORCIADO"],
  ["VIUDO", "VIUDO", "VIUDO"],
  // Unrecognized: column nulled, the answer as sent kept in rawData.
  ["complicado", null, "complicado"],
  ["", null, ""],
  [null, null, null]
];

function seeded() {
  const db = new Database(":memory:");
  db.exec(
    `CREATE TABLE "loan_applications" ("id" TEXT PRIMARY KEY, "marital_status" TEXT, "raw_data" TEXT NOT NULL)`
  );
  const insert = db.prepare(`INSERT INTO "loan_applications" VALUES (?, ?, ?)`);
  CASES.forEach(([value], i) =>
    insert.run(String(i), value, JSON.stringify(value === null ? {} : { maritalStatus: value }))
  );
  return db;
}

function read(db: Database.Database) {
  return db
    .prepare(
      `SELECT "marital_status" AS col, json_extract("raw_data", '$.maritalStatus') AS raw
       FROM "loan_applications" ORDER BY CAST("id" AS INTEGER)`
    )
    .all() as Array<{ col: string | null; raw: string | null }>;
}

describe("migration: marital status enum", () => {
  it("maps labels to codes, leaves codes alone and nulls unknown column values", () => {
    const db = seeded();
    db.exec(MIGRATION);

    read(db).forEach((row, i) => {
      const [before, col, raw] = CASES[i];
      expect(row.col, `column ${String(before)}`).to.equal(col);
      expect(row.raw, `rawData ${String(before)}`).to.equal(raw);
      if (row.col !== null) expect(MARITAL_STATUSES).to.include(row.col);
    });
  });

  it("is a no-op when run again", () => {
    const db = seeded();
    db.exec(MIGRATION);
    const once = read(db);
    db.exec(MIGRATION);
    expect(read(db)).to.deep.equal(once);
  });
});
