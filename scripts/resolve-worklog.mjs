#!/usr/bin/env node
/**
 * Resolves a merge conflict in docs/work-log/*.md by keeping both sides —
 * the incoming entries first, then ours — and formats the file. Two
 * branches that each add an entry never really conflict; git only sees
 * that they touched the same end of the file.
 *
 *   pnpm worklog:resolve        # after `git merge` reported the conflict
 *
 * Stages the resolved file; the caller commits. Exit 1 when a file still
 * holds a marker afterwards or the work-log check fails.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const dir = path.resolve('docs/work-log');
const marker = /<<<<<<< [^\n]*\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> [^\n]*\n/g;
const resolved = [];

for (const name of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
  const file = path.join(dir, name);
  const text = readFileSync(file, 'utf8');
  if (!text.includes('<<<<<<<')) continue;
  const out = text.replace(marker, (_, ours, theirs) => {
    const a = ours.endsWith('\n') ? ours : `${ours}\n`;
    return theirs.trim() ? `${theirs.trimEnd()}\n\n${a}` : a;
  });
  if (out.includes('<<<<<<<') || out.includes('>>>>>>>')) {
    console.error(`${name}: a marker survived — resolve it by hand.`);
    process.exit(1);
  }
  writeFileSync(file, out);
  resolved.push(file);
}

if (resolved.length === 0) {
  console.log('No conflict markers under docs/work-log/.');
  process.exit(0);
}

const run = (cmd, args) => spawnSync(cmd, args, { stdio: 'inherit' }).status ?? 1;
if (run('pnpm', ['exec', 'prettier', '--write', ...resolved]) !== 0) process.exit(1);
if (run('node', ['scripts/check-worklog.mjs']) !== 0) process.exit(1);
if (run('git', ['add', ...resolved]) !== 0) process.exit(1);
console.log(
  `Resolved and staged: ${resolved.map((f) => path.relative(process.cwd(), f)).join(', ')}`,
);
