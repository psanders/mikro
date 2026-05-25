/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import * as SQLite from "expo-sqlite";
import { runMigrations } from "./schema";

let db: SQLite.SQLiteDatabase | null = null;

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync("mikro.db");
    db.execSync("PRAGMA journal_mode = WAL");
    db.execSync("PRAGMA foreign_keys = ON");
    runMigrations(db);
  }
  return db;
}
