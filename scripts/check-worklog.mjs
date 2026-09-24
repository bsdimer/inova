#!/usr/bin/env node
/**
 * The work-log is an index of change sets, not the record of them: the record
 * is the PR description and the commit message. Unchecked, entries grew to
 * 1.5–6 KB each and a month reached 55 KB — too big to load, so nobody did.
 *
 * Every file: docs/work-log/YYYY-MM.md, first line `# Work log — YYYY-MM`,
 * entries `## YYYY-MM-DD — title` dated inside that month.
 * Entries dated from RULE_FROM: **Changed:** / **Verified:** / **Remains:**
 * once each, no sub-headings, at most MAX_CHARS characters. Entries dated from
 * ISSUE_FROM also name their Linear issue in the heading — `(WHI-nn)` or
 * `(#PR, WHI-nn)` — so a reader can follow the entry to the task and back.
 * Older entries are history and are left as written.
 *
 *   node scripts/check-worklog.mjs            # docs/work-log/*.md
 *   node scripts/check-worklog.mjs <files...> # explicit files (fixtures)
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RULE_FROM = '2026-09-23';
const MAX_CHARS = 700;
const ISSUE_FROM = '2026-09-24';
const ISSUE_REF = /\((?:#\d+, )?WHI-\d+\)$/;
const LABELS = ['**Changed:**', '**Verified:**', '**Remains:**'];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'docs', 'work-log');
const files =
  process.argv.length > 2
    ? process.argv.slice(2)
    : readdirSync(dir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => path.join(dir, f));

const failures = [];
const fail = (file, line, message) =>
  failures.push(`${path.relative(root, file)}:${line}: ${message}`);

function checkEntry(file, entry) {
  if (entry.date >= ISSUE_FROM && !ISSUE_REF.test(entry.title)) {
    fail(
      file,
      entry.line,
      `"${entry.title}" must end with its Linear issue: "(WHI-nn)" or "(#PR, WHI-nn)"`,
    );
  }
  const body = entry.lines.join('\n');
  for (const label of LABELS) {
    const count = body.split(label).length - 1;
    if (count !== 1)
      fail(file, entry.line, `"${entry.title}" needs ${label} exactly once (found ${count})`);
  }
  if (entry.lines.some((l) => /^#{1,6}\s/.test(l))) {
    fail(file, entry.line, `"${entry.title}" contains a heading; an entry is three labelled lines`);
  }
  const chars = entry.lines.join('').length;
  if (chars > MAX_CHARS) {
    fail(
      file,
      entry.line,
      `"${entry.title}" is ${chars} characters; the cap is ${MAX_CHARS}. Put the detail in the PR description.`,
    );
  }
}

for (const file of files) {
  const name = path.basename(file, '.md');
  const month = /^(\d{4}-\d{2})$/.exec(name)?.[1];
  const lines = readFileSync(file, 'utf8').split('\n');
  if (!month) {
    fail(file, 1, 'work-log files are named YYYY-MM.md');
    continue;
  }
  if (lines[0] !== `# Work log — ${month}`)
    fail(file, 1, `first line must be "# Work log — ${month}"`);

  let entry = null;
  const flush = () => {
    if (entry && entry.date >= RULE_FROM) checkEntry(file, entry);
    entry = null;
  };
  lines.forEach((text, i) => {
    const heading = /^## (\d{4}-\d{2}-\d{2}) — (.+)$/.exec(text);
    if (text.startsWith('## ')) {
      flush();
      if (!heading)
        return fail(file, i + 1, `entry heading must be "## YYYY-MM-DD — title": ${text}`);
      if (!heading[1].startsWith(month))
        fail(file, i + 1, `entry dated ${heading[1]} belongs in ${heading[1].slice(0, 7)}.md`);
      entry = { line: i + 1, date: heading[1], title: heading[2], lines: [] };
      return;
    }
    if (entry) entry.lines.push(text);
  });
  flush();
}

if (failures.length > 0) {
  console.error('Work-log check failed:');
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
console.log(`Work-log check passed (${files.length} files).`);
