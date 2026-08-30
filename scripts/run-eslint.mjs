#!/usr/bin/env node
/**
 * Run ESLint from the repo root so typescript-eslint resolves the root
 * TypeScript 5.x, not the TS 7 installed in admin/mobile.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const eslint = path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js');
const target = path.relative(root, process.cwd()) || '.';
const result = spawnSync(process.execPath, [eslint, target], {
  stdio: 'inherit',
  cwd: root,
});
process.exit(result.status ?? 1);
