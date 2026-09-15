#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const canonicalRelative = '.cursor/skills/inova-frontend/SKILL.md';
const adapterRelative = '.claude/skills/inova-frontend/SKILL.md';
const cleanCodeRelative = '.cursor/skills/inova-frontend/references/clean-code.md';

const requiredFiles = [
  'AGENTS.md',
  'CLAUDE.md',
  canonicalRelative,
  adapterRelative,
  cleanCodeRelative,
];

const errors = [];

for (const relativePath of requiredFiles) {
  if (!existsSync(resolve(repoRoot, relativePath))) {
    errors.push(`missing required harness file: ${relativePath}`);
  }
}

if (errors.length === 0) {
  const claudeContext = readFileSync(resolve(repoRoot, 'CLAUDE.md'), 'utf8');
  if (!claudeContext.split(/\r?\n/).includes('@AGENTS.md')) {
    errors.push('CLAUDE.md must import @AGENTS.md');
  }

  const canonicalPath = resolve(repoRoot, canonicalRelative);
  const canonical = readFileSync(canonicalPath, 'utf8');
  const localMarkdownLink = /\]\((?!https?:|#)([^)]+\.md)\)/g;

  for (const match of canonical.matchAll(localMarkdownLink)) {
    const target = resolve(dirname(canonicalPath), match[1]);
    if (!existsSync(target)) {
      errors.push(`broken frontend-skill reference: ${match[1]}`);
    }
  }

  if (!canonical.includes('references/clean-code.md')) {
    errors.push('canonical frontend skill must route to references/clean-code.md');
  }

  const adapterPath = resolve(repoRoot, adapterRelative);
  const adapter = readFileSync(adapterPath, 'utf8');
  const adapterTarget = '../../../.cursor/skills/inova-frontend/SKILL.md';
  const adapterFrontmatter = adapter.match(/^---\r?\n([\s\S]*?)\r?\n---/);

  if (!adapter.includes(adapterTarget)) {
    errors.push(`Claude adapter must point to ${adapterTarget}`);
  } else if (!existsSync(resolve(dirname(adapterPath), adapterTarget))) {
    errors.push('Claude adapter target does not exist');
  }

  if (!adapterFrontmatter) {
    errors.push('Claude adapter must have YAML frontmatter');
  } else if (
    /^disable-model-invocation\s*:\s*(?:true|yes|on|1)\s*$/im.test(adapterFrontmatter[1])
  ) {
    errors.push('Claude adapter must allow automatic invocation; remove disable-model-invocation');
  }
}

if (errors.length > 0) {
  console.error('Agent harness check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Agent harness check passed (${requiredFiles.length} required files).`);
