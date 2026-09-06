import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { runMigrations } from "./migrations.js";

export type RadarDatabase = Database.Database;

/**
 * Åbner (og opretter om nødvendigt) SQLite-databasen og kører migrationer.
 * Brug ":memory:" i tests.
 */
export function openDatabase(dbPath: string): RadarDatabase {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}
