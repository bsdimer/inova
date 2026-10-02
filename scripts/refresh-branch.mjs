#!/usr/bin/env node
/**
 * Brings the checked-out branch up to date after work lands on develop:
 *
 *   pnpm branch:refresh
 *
 * 1. merges origin/develop; a conflict only in docs/work-log/ is resolved
 *    with `pnpm worklog:resolve` and committed, any other conflict stops the
 *    run with the files listed;
 * 2. installs dependencies, migrates and reseeds the local database, and
 *    rebuilds shared, api and auth-service — the builds the e2e run starts.
 *
 * The database steps run even when the merge brought nothing: the local
 * database is shared by every worktree and lags whenever another branch
 * migrated it, which shows up later as red tests on correct code.
 *
 * Does not push. Exit 1 at the first step that fails, with what to do next.
 */
import { spawnSync } from 'node:child_process';

const base = 'origin/develop';
const worklogDir = 'docs/work-log/';

function git(...args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  return { ok: result.status === 0, out: result.stdout.trim() };
}

function step(title, cmd, args, hint) {
  console.log(`\n→ ${title}`);
  if ((spawnSync(cmd, args, { stdio: 'inherit' }).status ?? 1) !== 0) {
    stop(`${title} failed.`, hint);
  }
}

function stop(message, hint) {
  console.error(`\n✗ ${message}`);
  if (hint) console.error(`  ${hint}`);
  process.exit(1);
}

function mergeBase() {
  console.log(`→ Merge ${base}`);
  if (!git('fetch', 'origin', 'develop').ok) {
    stop('git fetch failed.', 'Check the network and SSH key.');
  }
  const merge = spawnSync('git', ['merge', '--no-edit', base], { stdio: 'inherit' });
  if (merge.status === 0) return;

  const conflicted = git('diff', '--name-only', '--diff-filter=U').out.split('\n').filter(Boolean);
  if (conflicted.length === 0) stop('git merge failed.');
  const other = conflicted.filter((file) => !file.startsWith(worklogDir));
  if (other.length > 0) {
    stop(
      `Conflicts outside the work-log:\n    ${other.join('\n    ')}`,
      'Resolve them (and `pnpm worklog:resolve` for the work-log), commit, then run `pnpm branch:refresh` again.',
    );
  }
  step(
    'Resolve the work-log',
    'pnpm',
    ['worklog:resolve'],
    'Resolve it by hand, commit, then run again.',
  );
  step('Commit the merge', 'git', ['commit', '--no-edit']);
}

const branch = git('rev-parse', '--abbrev-ref', 'HEAD').out;
if (branch === 'main') stop('On main: this command is for feature branches and develop.');
if (git('rev-parse', '-q', '--verify', 'MERGE_HEAD').ok) {
  stop(
    'A merge is in progress.',
    'Finish it (`git commit`) or abort it (`git merge --abort`) first.',
  );
}
if (git('status', '--porcelain', '--untracked-files=no').out !== '') {
  stop(
    'Uncommitted changes.',
    'Commit or stash them first: the merge must not mix with your edits.',
  );
}

mergeBase();
step('Install dependencies', 'pnpm', ['install', '--frozen-lockfile']);
const dbHint = 'Is the database up? docker compose -f infra/docker/docker-compose.yml up -d';
step('Migrate the local database', 'pnpm', ['db:migrate'], dbHint);
step('Seed the local database', 'pnpm', ['db:seed'], dbHint);
step('Build shared, api and auth-service', 'pnpm', [
  'exec',
  'turbo',
  'build',
  '--filter=@inova/shared',
  '--filter=@inova/api',
  '--filter=@inova/auth-service',
]);

console.log(`\n✓ ${branch} is up to date with ${base}. Push when ready: git push`);
