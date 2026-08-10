#!/usr/bin/env node
/**
 * Toolchain / build-parity gate.
 *
 * The dev workspace, GitHub Actions and Railway were each resolving a different
 * dependency graph:
 *   - Railway installed with `--no-frozen-lockfile` (CI used `--frozen-lockfile`)
 *   - Railway's pnpm predates workspace-level settings, so the
 *     `onlyBuiltDependencies` and `overrides` blocks in pnpm-workspace.yaml -
 *     which is where the security overrides live - were silently ignored there
 *   - `.npmrc` (shamefully-hoist) had been added to .gitignore, so the file that
 *     decides the node_modules layout was about to stop shipping to CI/Railway
 *
 * This script fails the build the moment any of those invariants breaks again.
 * Run with `--sync` to rewrite the generated mirrors instead of failing.
 */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SYNC = process.argv.includes('--sync');
const problems = [];
const notes = [];
const fixes = [];

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

/* ---------- tiny YAML reader for the two blocks we mirror ---------- */
function readBlock(yaml, key) {
  const lines = yaml.split('\n');
  const start = lines.findIndex((l) => l.startsWith(key + ':'));
  if (start === -1) return null;
  const body = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) break;
    body.push(line);
  }
  return body;
}
const unquote = (s) => s.trim().replace(/^['"]|['"]$/g, '');
function readList(yaml, key) {
  const body = readBlock(yaml, key);
  if (!body) return null;
  return body.filter((l) => l.trim().startsWith('- ')).map((l) => unquote(l.trim().slice(2)));
}
function readMap(yaml, key) {
  const body = readBlock(yaml, key);
  if (!body) return null;
  const out = {};
  for (const line of body) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const k = unquote(line.slice(0, idx));
    const v = unquote(line.slice(idx + 1));
    if (k) out[k] = v;
  }
  return out;
}

/* ---------- 1. pnpm settings must be readable by every pnpm version ---------- */
const ws = read('pnpm-workspace.yaml');
const pkgPath = path.join(ROOT, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const wsBuilt = readList(ws, 'onlyBuiltDependencies') || [];
const wsOverrides = readMap(ws, 'overrides') || {};
pkg.pnpm = pkg.pnpm || {};

const sameList = (a, b) => JSON.stringify([...(a||[])].sort()) === JSON.stringify([...(b||[])].sort());
const sameMap = (a, b) => {
  const ka = Object.keys(a||{}).sort(), kb = Object.keys(b||{}).sort();
  if (JSON.stringify(ka) !== JSON.stringify(kb)) return false;
  return ka.every((k) => a[k] === b[k]);
};

let pkgDirty = false;
if (!sameList(pkg.pnpm.onlyBuiltDependencies, wsBuilt)) {
  if (SYNC) { pkg.pnpm.onlyBuiltDependencies = [...wsBuilt].sort(); pkgDirty = true; fixes.push('synced pnpm.onlyBuiltDependencies'); }
  else problems.push('package.json#pnpm.onlyBuiltDependencies does not mirror pnpm-workspace.yaml. Railway\'s pnpm only reads the package.json copy, so native build scripts (' + wsBuilt.join(', ') + ') would be skipped there. Run: pnpm verify:toolchain -- --sync');
}
if (!sameMap(pkg.pnpm.overrides, wsOverrides)) {
  if (SYNC) { pkg.pnpm.overrides = Object.fromEntries(Object.keys(wsOverrides).sort().map((k) => [k, wsOverrides[k]])); pkgDirty = true; fixes.push('synced pnpm.overrides'); }
  else problems.push('package.json#pnpm.overrides does not mirror pnpm-workspace.yaml. The security overrides pinned there would not be applied on Railway. Run: pnpm verify:toolchain -- --sync');
}
if (pkgDirty) fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

/* ---------- 2. the toolchain must be pinned ---------- */
if (!pkg.packageManager || !/^pnpm@\d+\.\d+\.\d+$/.test(pkg.packageManager)) {
  problems.push('package.json#packageManager must pin an exact pnpm version (got: ' + pkg.packageManager + ')');
}
const pinned = String(pkg.packageManager || '').split('@')[1] || '';
const [pMaj, pMin] = pinned.split('.').map(Number);
if (pinned && (pMaj < 10 || (pMaj === 10 && pMin < 16))) {
  problems.push('pnpm ' + pinned + ' is too old: pnpm-workspace.yaml settings (minimumReleaseAge, overrides, onlyBuiltDependencies) need >= 10.16.0');
}
if (!exists('.nvmrc')) problems.push('.nvmrc is missing - CI and Railway have nothing to pin Node against');

/* ---------- 3. .npmrc must ship (it decides the node_modules layout) ---------- */
if (!exists('.npmrc')) {
  problems.push('.npmrc is missing - shamefully-hoist would flip and production imports would break');
} else if (exists('.git')) {
  let tracked = '';
  try { tracked = cp.execSync('git ls-files --error-unmatch .npmrc', { cwd: ROOT, stdio: ['ignore','pipe','ignore'] }).toString().trim(); } catch { /* untracked */ }
  if (!tracked) problems.push('.npmrc exists locally but is NOT tracked by git, so CI and Railway install with a different node_modules layout than the dev workspace');
}
if (/^\s*\.npmrc\s*$/m.test(read('.gitignore'))) {
  problems.push('.gitignore ignores .npmrc - that file carries install semantics, not secrets');
}

/* ---------- 4. every installer must be reproducible ---------- */
const nixpacks = exists('nixpacks.toml') ? read('nixpacks.toml') : '';
if (nixpacks.includes('--no-frozen-lockfile')) {
  problems.push('nixpacks.toml installs with --no-frozen-lockfile: Railway silently re-resolves the dependency graph, so it can ship a tree CI never tested');
}
if (nixpacks && !nixpacks.includes('--frozen-lockfile')) {
  problems.push('nixpacks.toml must install with --frozen-lockfile');
}
const railway = exists('railway.toml') ? read('railway.toml') : '';
const buildLine = (railway.match(/^buildCommand\s*=\s*"(.*)"$/m) || [])[1] || '';
if (/(^|&&\s*)pnpm install(?!\s*--frozen-lockfile)/.test(buildLine)) {
  problems.push('railway.toml buildCommand runs a second, unpinned `pnpm install` after the install phase - drop it or pin --frozen-lockfile');
}
const wfDir = path.join(ROOT, '.github', 'workflows');
if (fs.existsSync(wfDir)) {
  for (const f of fs.readdirSync(wfDir).filter((n) => /\.ya?ml$/.test(n))) {
    const body = fs.readFileSync(path.join(wfDir, f), 'utf8');
    if (body.includes('pnpm install') && !body.includes('--frozen-lockfile')) {
      problems.push('.github/workflows/' + f + ' installs without --frozen-lockfile');
    }
  }
}

/* ---------- 5. advisory: runtime versions ---------- */
if (exists('.nvmrc')) {
  const want = read('.nvmrc').trim();
  const have = process.versions.node.split('.')[0];
  if (want !== have) notes.push('Node major differs from .nvmrc (want ' + want + ', running ' + have + '). CI and Railway use .nvmrc.');
}

/* ---------- report ---------- */
if (fixes.length) console.log('verify-toolchain: ' + fixes.join('; '));
for (const n of notes) console.log('verify-toolchain: note: ' + n);
if (problems.length) {
  console.error('\nverify-toolchain: build parity is broken:\n');
  problems.forEach((p, i) => console.error('  ' + (i + 1) + '. ' + p + '\n'));
  process.exit(1);
}
console.log('verify-toolchain: ok - dev, CI and Railway resolve the same dependency graph');
