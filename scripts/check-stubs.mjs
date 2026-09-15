#!/usr/bin/env node
/**
 * Every mock/stub must be greppable: TODO(M<n>) or MOCK.
 * Fails on bare TODO / FIXME / HACK and on unmarked fake/stub/placeholder data.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);

const files = execFileSync('git', ['ls-files', '*.ts', '*.tsx', '*.js', '*.mjs'], {
  cwd: root,
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(Boolean);

const unmarkedTodo = /(?:\/\/|\/\*)\s*(TODO|FIXME|HACK)\b(?!\(M\d)/;
const fakeData = /\b(fakeData|placeholderData|dummyData)\b/;

const failures = [];

for (const file of files) {
  if (file.startsWith('scripts/check-stubs')) continue;
  const fileUrl = new URL(file, root);
  // git ls-files includes cached paths deleted by an unstaged rename.
  if (!existsSync(fileUrl)) continue;
  const text = readFileSync(fileUrl, 'utf8');
  text.split('\n').forEach((line, i) => {
    if (unmarkedTodo.test(line)) {
      failures.push(`${file}:${i + 1}: unmarked ${line.trim()}`);
    }
    if (fakeData.test(line) && !line.includes('TODO(M') && !line.includes('MOCK')) {
      failures.push(`${file}:${i + 1}: unmarked fake/placeholder data`);
    }
  });
}

if (failures.length) {
  console.error('check:stubs failed:\n' + failures.map((f) => `  ${f}`).join('\n'));
  process.exit(1);
}
console.log(`check:stubs ok (${files.length} files)`);
