#!/usr/bin/env node
/**
 * Fresh-migrate + rerun + checksum integrity against a unique database.
 * Requires a reachable Postgres cluster (TEST_PG_URL or local docker default).
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { migrate } from '../db/migrate.mjs';

const cluster = process.env.TEST_PG_URL ?? 'postgres://sosedo:sosedo@localhost:5432';
const name = `sosedo_check_mig_${process.pid}_${Date.now().toString(36)}`;
const url = `${cluster}/${name}`;

const admin = new pg.Client({ connectionString: `${cluster}/postgres` });
await admin.connect();
try {
  await admin.query(`CREATE DATABASE ${name}`);
} finally {
  await admin.end();
}

try {
  await migrate(url, { quiet: true });
  await migrate(url, { quiet: true });

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const rows = (await client.query('SELECT name, checksum FROM schema_migrations ORDER BY name'))
      .rows;
    const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');
    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    if (rows.length !== files.length) {
      throw new Error(`applied ${rows.length} migrations, found ${files.length} files`);
    }
    for (const file of files) {
      const row = rows.find((r) => r.name === file);
      if (!row) throw new Error(`missing schema_migrations row for ${file}`);
      const sql = await readFile(path.join(dir, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      if (row.checksum !== checksum) {
        throw new Error(`checksum mismatch for ${file}`);
      }
    }
    console.log(`check:migrations ok (${files.length} files, rerun idempotent, checksums match)`);
  } finally {
    await client.end();
  }
} finally {
  const drop = new pg.Client({ connectionString: `${cluster}/postgres` });
  await drop.connect();
  try {
    await drop.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  } finally {
    await drop.end();
  }
}
