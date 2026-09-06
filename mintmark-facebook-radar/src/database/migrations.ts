import type Database from "better-sqlite3";

interface Migration {
  version: number;
  name: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "initial",
    sql: `
      CREATE TABLE IF NOT EXISTS posts (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        facebook_post_id  TEXT    NOT NULL,
        group_id          TEXT    NOT NULL,
        group_name        TEXT    NOT NULL,
        post_url          TEXT,
        post_text         TEXT    NOT NULL,
        post_time_text    TEXT,
        first_seen_at     TEXT    NOT NULL,
        classified_at     TEXT,
        classification    TEXT,
        relevant          INTEGER,
        confidence        REAL,
        reason            TEXT,
        classifier        TEXT,
        classification_error TEXT,
        review_status     TEXT    NOT NULL DEFAULT 'pending',
        human_relevant    INTEGER,
        reviewed_at       TEXT
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_facebook_post_id ON posts (facebook_post_id);
      CREATE INDEX IF NOT EXISTS idx_posts_group_id ON posts (group_id);
      CREATE INDEX IF NOT EXISTS idx_posts_relevant_review ON posts (relevant, review_status);
      CREATE INDEX IF NOT EXISTS idx_posts_classified_at ON posts (classified_at);
      CREATE INDEX IF NOT EXISTS idx_posts_first_seen_at ON posts (first_seen_at);

      CREATE TABLE IF NOT EXISTS scans (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at    TEXT NOT NULL,
        finished_at   TEXT,
        groups_total  INTEGER NOT NULL DEFAULT 0,
        posts_found   INTEGER NOT NULL DEFAULT 0,
        posts_new     INTEGER NOT NULL DEFAULT 0,
        parse_errors  INTEGER NOT NULL DEFAULT 0,
        classify_errors INTEGER NOT NULL DEFAULT 0,
        status        TEXT NOT NULL DEFAULT 'running',
        note          TEXT
      );
    `,
  },
];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
  const applied = new Set(
    (db.prepare("SELECT version FROM schema_migrations").all() as { version: number }[]).map((r) => r.version),
  );
  const insert = db.prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)");
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    db.transaction(() => {
      db.exec(migration.sql);
      insert.run(migration.version, migration.name, new Date().toISOString());
    })();
  }
}
