#!/usr/bin/env node
/**
 * Plain-SQL migration runner (see AGENTS.md: migrations are hand-written SQL).
 * Applies db/migrations/*.sql in filename order, tracking applied files in
 * schema_migrations. Connects as the privileged migrator role — the runtime
 * `sosedo_app` role must never own or alter schema.
 *
 * Usage:
 *   node db/migrate.mjs                  # migrate DATABASE_URL_MIGRATOR (or local default)
 *   node db/migrate.mjs --url <pg-url>   # migrate an explicit database (used by tests)
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, 'migrations');

const urlFlag = process.argv.indexOf('--url');
const databaseUrl =
  urlFlag !== -1
    ? process.argv[urlFlag + 1]
    : (process.env.DATABASE_URL_MIGRATOR ?? 'postgres://sosedo:sosedo@localhost:5432/sosedo');

export async function migrate(url = databaseUrl, { quiet = false } = {}) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );

    const applied = new Set(
      (await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name),
    );

    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(path.join(migrationsDir, file), 'utf8');
      if (!quiet) console.log(`applying ${file} ...`);
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    }

    if (!quiet) console.log('migrations up to date.');
  } finally {
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
