#!/usr/bin/env node
/**
 * Decision cards: from D29 on, a decision is one file under
 * docs/plan/decisions/ (docs/plan/decisions/README.md has the template). The
 * table in docs/plan/decisions.md stays the index; rows before CARD_FROM keep
 * their text there and count as their own card.
 *
 * Three rules, so that "we forgot to add it there" stops being a review
 * finding:
 *   1. every file listed under "## Lands in" mentions the card's id;
 *   2. no D-id >= CARD_FROM appears anywhere in docs/ without a card;
 *   3. a card with status "decided" has a non-empty Lands in.
 * Plus the shape: the file is D<n>-*.md, its frontmatter id matches, status
 * is one of STATUSES. Only the path of a Lands in item is read; text after
 * "→" is for the reader.
 *
 *   node scripts/check-decisions.mjs
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CARD_FROM = 29;
const STATUSES = ['proposed', 'decided', 'deferred', 'superseded'];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cardsDir = path.join(root, 'docs', 'plan', 'decisions');
const docsDir = path.join(root, 'docs');

const failures = [];
const fail = (file, message) => failures.push(`${path.relative(root, file)}: ${message}`);

function walkMarkdown(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walkMarkdown(full, out);
    else if (name.endsWith('.md')) out.push(full);
  }
  return out;
}

function parseCard(file) {
  const text = readFileSync(file, 'utf8');
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!fm) {
    fail(file, 'a card starts with a frontmatter block (--- ... ---)');
    return null;
  }
  const fields = {};
  for (const line of fm[1].split('\n')) {
    const m = /^([a-z]+):\s*(.*)$/.exec(line);
    if (m) fields[m[1]] = m[2].replace(/\s*#.*$/, '').trim();
  }
  const body = text.slice(fm[0].length);
  const start = body.indexOf('\n## Lands in');
  const landsIn = [];
  if (start >= 0) {
    const rest = body.slice(start + '\n## Lands in'.length);
    const end = rest.indexOf('\n## ');
    const section = end >= 0 ? rest.slice(0, end) : rest;
    for (const line of section.split('\n')) {
      const m = /^- `([^`]+)`/.exec(line.trim());
      if (m) landsIn.push(m[1]);
    }
  }
  return { file, fields, landsIn };
}

const cards = new Map();
const cardFiles = existsSync(cardsDir)
  ? readdirSync(cardsDir).filter((f) => /^D\d+-.*\.md$/.test(f))
  : [];

for (const name of cardFiles) {
  const file = path.join(cardsDir, name);
  const card = parseCard(file);
  if (!card) continue;
  const idFromName = /^(D\d+)-/.exec(name)[1];
  if (card.fields.id !== idFromName)
    fail(file, `frontmatter id "${card.fields.id}" does not match the file name (${idFromName})`);
  if (!STATUSES.includes(card.fields.status))
    fail(file, `status "${card.fields.status}" is not one of ${STATUSES.join(' | ')}`);
  if (card.fields.status === 'decided' && card.landsIn.length === 0)
    fail(file, 'a decided card lists where it lands ("## Lands in", one `path` per item)');
  for (const rel of card.landsIn) {
    const target = path.join(root, rel);
    if (!existsSync(target)) {
      fail(file, `Lands in names a file that does not exist: ${rel}`);
      continue;
    }
    const idPattern = new RegExp(`\\b${idFromName}\\b`);
    if (!idPattern.test(readFileSync(target, 'utf8')))
      fail(file, `${rel} does not mention ${idFromName} — the decision has not landed there`);
  }
  cards.set(idFromName, card);
}

// Rule 2: every D-id from CARD_FROM on that the docs mention has a card.
const idRe = /\bD(\d+)\b/g;
for (const file of walkMarkdown(docsDir)) {
  if (file.startsWith(cardsDir + path.sep)) continue;
  const text = readFileSync(file, 'utf8');
  const missing = new Set();
  for (const m of text.matchAll(idRe)) {
    const n = Number(m[1]);
    if (n >= CARD_FROM && !cards.has(`D${n}`)) missing.add(`D${n}`);
  }
  for (const id of missing)
    fail(file, `mentions ${id} but docs/plan/decisions/ has no card for it`);
}

if (failures.length > 0) {
  console.error('Decision cards check failed:');
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
console.log(`Decision cards check passed (${cards.size} cards).`);
