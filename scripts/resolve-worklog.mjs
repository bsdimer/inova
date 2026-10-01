#!/usr/bin/env node
/**
 * Resolves a merge conflict in docs/work-log/*.md by keeping both sides —
 * the incoming entries first, then ours — and formats the file. Two
 * branches that each add an entry never really conflict; git only sees
 * that they touched the same end of the file.
 *
 *   pnpm worklog:resolve        # after `git merge` reported the conflict
 *
 * The file is rebuilt from the two whole versions git keeps for a conflict
 * (stage 2 ours, stage 3 theirs), not from the text between the markers:
 * when two entries end with the same line, git leaves that line outside the
 * markers, and stitching the marked parts gave it to one entry only. The
 * head of the file (title and note) is taken once, from theirs.
 *
 * Stages the resolved file; the caller commits. Exit 1 when a conflicted
 * work-log has no two sides to read or the work-log check fails.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const dir = 'docs/work-log';

function git(...args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  return result.status === 0 ? result.stdout : null;
}

/** The head of a work-log and its entries, each from its `## ` heading on. */
function split(text) {
  const parts = text.split(/^(?=## )/m);
  const head = parts[0].startsWith('## ') ? '' : parts.shift();
  return { head: head.trimEnd(), entries: parts.map((entry) => entry.trimEnd()) };
}

/** An entry's identity: its heading without the «(#PR, WHI-nn)» that grows later. */
function key(entry) {
  return entry
    .split('\n', 1)[0]
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
}

const conflicted = [
  ...new Set(
    (git('diff', '--name-only', '--diff-filter=U', '--', `${dir}/*.md`) ?? '')
      .split('\n')
      .filter(Boolean),
  ),
];

if (conflicted.length === 0) {
  console.log(`No conflicted files under ${dir}/.`);
  process.exit(0);
}

for (const file of conflicted) {
  const ours = git('show', `:2:${file}`);
  const theirs = git('show', `:3:${file}`);
  if (ours === null || theirs === null) {
    console.error(`${file}: one side deleted the file — resolve it by hand.`);
    process.exit(1);
  }
  const incoming = split(theirs);
  const own = split(ours);
  const seen = new Set(incoming.entries.map(key));
  const entries = [...incoming.entries, ...own.entries.filter((entry) => !seen.has(key(entry)))];
  const head = incoming.head || own.head;
  writeFileSync(file, `${[head, ...entries].filter(Boolean).join('\n\n')}\n`);
}

function run(cmd, args) {
  return spawnSync(cmd, args, { stdio: 'inherit' }).status ?? 1;
}
if (run('pnpm', ['exec', 'prettier', '--write', ...conflicted]) !== 0) process.exit(1);
if (run('node', ['scripts/check-worklog.mjs']) !== 0) process.exit(1);
if (run('git', ['add', ...conflicted]) !== 0) process.exit(1);
console.log(`Resolved and staged: ${conflicted.join(', ')}`);
