#!/usr/bin/env node
/**
 * Executable Definition of Done. A green run means the technical DoD is met.
 * Do not skip steps or pick a shorter subset.
 */
import { spawnSync } from 'node:child_process';
import net from 'node:net';

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
  ['check:worklog', ['pnpm', 'check:worklog']],
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

/**
 * The integration suites need a PostgreSQL cluster. Check before the first step:
 * without this the run fails minutes in, with a wall of ECONNREFUSED.
 */
async function assertPostgresReachable() {
  const url = new URL(process.env.TEST_PG_URL ?? 'postgres://inova:inova@localhost:5432');
  const port = Number(url.port || 5432);
  const reachable = await new Promise((resolve) => {
    const socket = net.connect({ host: url.hostname, port, timeout: 3000 });
    // Settle exactly once and destroy the socket: the steps below block the
    // event loop with spawnSync, and a socket left open would report an idle
    // "timeout" minutes later, after a passing run.
    const settle = (result) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };
    socket.once('connect', () => settle(true));
    socket.once('timeout', () => settle(false));
    socket.once('error', () => settle(false));
  });
  if (!reachable) {
    console.error(
      `verify cannot start: no PostgreSQL at ${url.hostname}:${port} (integration tests need it).\n` +
        'Start local infra:  docker compose -f infra/docker/docker-compose.yml up -d\n' +
        'or point TEST_PG_URL at a cluster. Diagnose with:  pnpm doctor',
    );
    process.exit(1);
  }
}

await assertPostgresReachable();

for (const [name, argv] of steps) {
  run(name, argv);
}

console.log('\nverify passed.');
