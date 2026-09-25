#!/usr/bin/env node
/**
 * The admin's «design data» preview (apps/admin/src/lib/designFixture.ts)
 * must not reach a deployed build: docs/features/admin-dashboard.md — a
 * deployed build never shows mock numbers. This reads the built admin
 * (apps/admin/dist, made by `pnpm build` without VITE_DESIGN_FIXTURES) and
 * fails if any sample value from the fixtures is in it.
 *
 * Markers are checked on the decoded bundle: the bundler may write Cyrillic
 * as \uXXXX escapes, and a plain text search would then pass on anything.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'apps', 'admin', 'dist', 'assets');

// One value per fixture, plus the preview's own note. Keep in step with
// apps/admin/src/pages/dashboard/fixture.ts.
const MARKERS = ['3760961', 'Теч в мазето', 'Проверка на асансьор', 'Данни от макета'];

if (!existsSync(assets)) {
  console.error('check:no-design-data: apps/admin/dist is missing — run `pnpm build` first.');
  process.exit(1);
}

const bundle = readdirSync(assets)
  .filter((file) => file.endsWith('.js'))
  .map((file) => readFileSync(path.join(assets, file), 'utf8'))
  .join('\n')
  .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

const found = MARKERS.filter((marker) => bundle.includes(marker));
if (found.length > 0) {
  console.error(
    `check:no-design-data: the admin build carries design sample data: ${found.join(', ')}.\n` +
      'Guard every use of the fixtures with the literal ' +
      "`import.meta.env.DEV || import.meta.env.VITE_DESIGN_FIXTURES === '1'` (lib/designFixture.ts).",
  );
  process.exit(1);
}
console.log('Design-data check passed (admin build carries no sample data).');
