#!/usr/bin/env node
/**
 * Executable Definition of Done. A green run means the technical DoD is met.
 * Do not skip steps or pick a shorter subset.
 */
import { spawnSync } from 'node:child_process';

const steps = [
  ['format:check', ['pnpm', 'format:check']],
  ['lint', ['pnpm', 'lint']],
  ['typecheck', ['pnpm', 'typecheck']],
  ['test:unit', ['pnpm', 'test:unit']],
  ['test:integration', ['pnpm', 'test:integration']],
  ['check:stubs', ['pnpm', 'check:stubs']],
  ['check:brands', ['pnpm', 'check:brands']],
  ['check:routes', ['pnpm', 'check:routes']],
  ['check:agent-harness', ['pnpm', 'check:agent-harness']],
  ['check:migrations', ['pnpm', 'check:migrations']],
  ['build', ['pnpm', 'build']],
];

function run(name, argv) {
  console.log(`\n==> ${name}`);
  const [cmd, ...args] = argv;
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  if (result.status !== 0) {
    console.error(`\nverify failed at: ${name}`);
    process.exit(result.status ?? 1);
  }
  return result;
}

for (const [name, argv] of steps) {
  run(name, argv);
}

console.log('\nverify passed.');
