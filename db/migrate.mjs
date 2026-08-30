#!/usr/bin/env node
/**
 * Plain-SQL migration runner (see AGENTS.md: migrations are hand-written SQL).
 * Applies db/migrations/*.sql in filename order, tracking applied files in
 * schema_migrations. Connects as the privileged migrator role — the runtime
 * `sosedo_app` role must never own or alter schema.
 *
 * - PostgreSQL advisory lock so two runners cannot interleave.
 * - SHA-256 checksum of each file; changing an already-applied file fails.
 * - SQL + schema_migrations insert always run in one transaction. Migration
 *   files must not contain transaction-control statements.
 *
 * Usage:
 *   node db/migrate.mjs                  # migrate DATABASE_URL_MIGRATOR (or local default)
 *   node db/migrate.mjs --url <pg-url>   # migrate an explicit database (used by tests)
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, 'migrations');
const ADVISORY_LOCK = 872461203;

const urlFlag = process.argv.indexOf('--url');
const databaseUrl =
  urlFlag !== -1
    ? process.argv[urlFlag + 1]
    : (process.env.DATABASE_URL_MIGRATOR ?? 'postgres://sosedo:sosedo@localhost:5432/sosedo');

function checksum(sql) {
  return createHash('sha256').update(sql).digest('hex');
}

function containsTransactionControl(sql) {
  return /^\s*(?:BEGIN(?:\s+(?:WORK|TRANSACTION))?|START\s+TRANSACTION|COMMIT(?:\s+WORK)?|ROLLBACK(?:\s+WORK)?)\s*;/im.test(
    sql,
  );
}

export async function migrate(url = databaseUrl, { quiet = false } = {}) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK]);
    try {
      await client.query(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
           name text PRIMARY KEY,
           applied_at timestamptz NOT NULL DEFAULT now(),
           checksum text
         )`,
      );
      await client.query(`ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum text`);

      const applied = new Map(
        (await client.query('SELECT name, checksum FROM schema_migrations')).rows.map((r) => [
          r.name,
          r.checksum,
        ]),
      );

      const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

      for (const file of files) {
        const sql = await readFile(path.join(migrationsDir, file), 'utf8');
        const hash = checksum(sql);
        if (applied.has(file)) {
          const stored = applied.get(file);
          if (stored && stored !== hash) {
            throw new Error(
              `Migration ${file} was already applied but the file changed ` +
                `(checksum ${stored.slice(0, 8)}… → ${hash.slice(0, 8)}…). ` +
                'Write a new migration; do not edit applied SQL.',
            );
          }
          if (!stored) {
            await client.query('UPDATE schema_migrations SET checksum = $1 WHERE name = $2', [
              hash,
              file,
            ]);
          }
          continue;
        }

        if (!quiet) console.log(`applying ${file} ...`);
        if (containsTransactionControl(sql)) {
          throw new Error(
            `Migration ${file} contains transaction control. ` +
              'The migration runner owns BEGIN/COMMIT so schema changes and bookkeeping stay atomic.',
          );
        }
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [
            file,
            hash,
          ]);
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        }
      }

      if (!quiet) console.log('migrations up to date.');
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK]).catch(() => {});
    }
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
