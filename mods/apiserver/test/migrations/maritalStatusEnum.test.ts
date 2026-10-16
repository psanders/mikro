/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The marital-status enum migration maps every value prod holds (form labels
 * plus the variants José typed) to a code, and nulls anything else: Prisma
 * fails a read on a value outside the enum.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { expect } from "chai";
import { MARITAL_STATUSES } from "@mikro/common";

const MIGRATION = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../prisma/migrations/20261016120000_marital_status_enum/migration.sql"
);

describe("migration: marital status enum", () => {
  it("maps prod's labels and variants to codes and nulls the rest", () => {
    const db = new Database(":memory:");
    db.exec(`CREATE TABLE "loan_applications" ("id" TEXT PRIMARY KEY, "marital_status" TEXT)`);
    const cases: Array<[string | null, string | null]> = [
      ["Soltero(a)", "SOLTERO"],
      ["Soltero/a", "SOLTERO"],
      ["Soltera", "SOLTERO"],
      ["Casado(a)", "CASADO"],
      ["Unión libre", "UNION_LIBRE"],
      ["Divorciado(a)", "DIVORCIADO"],
      ["Viudo(a)", "VIUDO"],
      ["CASADO", "CASADO"],
      ["complicado", null],
      [null, null]
    ];
    const insert = db.prepare(`INSERT INTO "loan_applications" VALUES (?, ?)`);
    cases.forEach(([value], i) => insert.run(String(i), value));

    db.exec(readFileSync(MIGRATION, "utf-8"));

    const rows = db
      .prepare(
        `SELECT "id", "marital_status" AS m FROM "loan_applications" ORDER BY CAST("id" AS INTEGER)`
      )
      .all() as Array<{ id: string; m: string | null }>;
    rows.forEach((row, i) => expect(row.m, String(cases[i][0])).to.equal(cases[i][1]));
    for (const row of rows) {
      if (row.m !== null) expect(MARITAL_STATUSES).to.include(row.m);
    }
  });
});
