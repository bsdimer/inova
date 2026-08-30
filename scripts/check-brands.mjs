#!/usr/bin/env node
/**
 * Every brands/<key>/brand.json must pass brandConfigSchema.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sharedDist = path.join(root, 'packages/shared/dist/index.js');

const { parseBrandConfig } = await import(pathToFileURL(sharedDist).href);

const brandsDir = path.join(root, 'brands');
const keys = readdirSync(brandsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

if (keys.length === 0) {
  console.error('check:brands: no brand folders under brands/');
  process.exit(1);
}

for (const key of keys) {
  const file = path.join(brandsDir, key, 'brand.json');
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  parseBrandConfig(raw);
  console.log(`  ok  brands/${key}/brand.json`);
}
console.log(`check:brands ok (${keys.length})`);
