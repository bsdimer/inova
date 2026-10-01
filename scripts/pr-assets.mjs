#!/usr/bin/env node
/**
 * Publishes screenshots for a pull request to one shared branch, a folder
 * per issue, and prints the <img> lines for the PR description. The branch
 * is written with git plumbing only, so the working tree, the index and the
 * current branch are never touched.
 *
 *   pnpm pr-assets whi-106 e2e-screens/roles.png e2e-screens/roles-402.png
 *
 * Options: --branch <name> (default pr-screenshots), --remote <name>
 * (default origin), --repo <owner/name> (default: read from the remote URL).
 * A file with the same name in the folder is replaced; others stay. The old
 * per-issue branches pr-assets/whi-NN are left as they are — git cannot hold
 * a branch named pr-assets next to them, hence the different name.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const options = { branch: 'pr-screenshots', remote: 'origin', repo: '' };
const positional = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  const key = arg.startsWith('--') ? arg.slice(2) : '';
  if (Object.hasOwn(options, key)) {
    options[key] = argv[++i] ?? '';
    if (!options[key] || options[key].startsWith('--')) fail(`${arg} needs a value`);
  } else if (key) {
    fail(`unknown option ${arg}`);
  } else {
    positional.push(arg);
  }
}

const [issue = '', ...files] = positional;
const folder = issue.toLowerCase();
if (!/^whi-\d+$/.test(folder) || files.length === 0) {
  fail('usage: pnpm pr-assets whi-NN a.png [b.png …]');
}
for (const file of files) {
  if (!existsSync(file)) fail(`${file}: no such file`);
  if (!/\.(png|jpe?g|webp|gif)$/i.test(file)) fail(`${file}: not an image`);
}
const names = files.map((file) => path.basename(file));
const duplicate = names.find((name, i) => names.indexOf(name) !== i);
if (duplicate) fail(`${duplicate}: two files with one name`);

const repo = options.repo || repoFromRemote(git('remote', 'get-url', options.remote));
const ref = `refs/heads/${options.branch}`;
const parent = fetchTip();

const folderEntries = new Map(parent ? treeEntries(`${parent}:${folder}`) : []);
names.forEach((name, i) => {
  folderEntries.set(name, `100644 blob ${git('hash-object', '-w', files[i])}\t${name}`);
});
const folderTree = mktree([...folderEntries.values()]);

const rootEntries = new Map(parent ? treeEntries(`${parent}^{tree}`) : []);
rootEntries.set(folder, `040000 tree ${folderTree}\t${folder}`);
const rootTree = mktree([...rootEntries.values()]);

const message = `${folder}: ${names.join(', ')}`;
const commit = git('commit-tree', rootTree, ...(parent ? ['-p', parent] : []), '-m', message);
try {
  git('push', '--quiet', options.remote, `${commit}:${ref}`);
} catch {
  // Usually someone pushed to the branch after the fetch; git never
  // overwrites it, so running again on the new tip is safe.
  fail(`push to ${options.branch} was refused (git says why above) — run the command again`);
}

for (const name of names) {
  const url = `https://raw.githubusercontent.com/${repo}/${options.branch}/${folder}/${encodeURIComponent(name)}`;
  console.log(`<img src="${url}" width="700">`);
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] }).trim();
}

/** The branch tip on the remote, or '' when the branch does not exist yet. */
function fetchTip() {
  if (!git('ls-remote', '--heads', options.remote, ref)) return '';
  git('fetch', '--quiet', options.remote, ref);
  return git('rev-parse', 'FETCH_HEAD');
}

/** Entries of a tree as name → mktree line; none when the path is absent. */
function treeEntries(treeish) {
  let listing;
  try {
    listing = execFileSync('git', ['ls-tree', treeish], { encoding: 'utf8', stdio: 'pipe' });
  } catch {
    return [];
  }
  return listing
    .split('\n')
    .filter(Boolean)
    .map((line) => [line.slice(line.indexOf('\t') + 1), line]);
}

function mktree(lines) {
  return execFileSync('git', ['mktree'], {
    input: `${lines.join('\n')}\n`,
    encoding: 'utf8',
  }).trim();
}

function repoFromRemote(url) {
  const match = url.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
  if (!match) fail(`${url}: not a GitHub remote — pass --repo owner/name`);
  return match[1];
}

function fail(text) {
  console.error(`pr-assets: ${text}`);
  process.exit(1);
}
