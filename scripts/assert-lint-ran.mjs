#!/usr/bin/env node
/**
 * turbo lint used to succeed with "0 tasks" when no workspace had a lint script.
 * Fail the gate if fewer than the expected packages reported a lint task.
 */
import { spawnSync } from 'node:child_process';

const expected = [
  '@sosedo/api',
  '@sosedo/auth-service',
  '@sosedo/admin',
  '@sosedo/mobile',
  '@sosedo/shared',
];

const result = spawnSync('pnpm', ['exec', 'turbo', 'lint', '--dry-run=json'], {
  encoding: 'utf8',
});

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

let payload;
try {
  payload = JSON.parse(result.stdout.trim().split('\n').at(-1) ?? '{}');
} catch {
  // turbo dry-run=json prints a JSON object; fall back to scanning text
  payload = null;
}

const packages = new Set();
if (payload?.tasks) {
  for (const task of payload.tasks) {
    if (task.task === 'lint' && task.package) packages.add(task.package);
  }
} else {
  for (const name of expected) {
    if (result.stdout.includes(name) && result.stdout.includes('lint')) {
      packages.add(name);
    }
  }
}

const missing = expected.filter((name) => !packages.has(name));
if (missing.length > 0 || packages.size === 0) {
  console.error(
    `lint gate ran ${packages.size} package(s); expected ${expected.join(', ')}.` +
      (missing.length ? ` Missing: ${missing.join(', ')}.` : ''),
  );
  process.exit(1);
}
