// diff.mjs — computes the "all open changes" change set for PR Self-Review.
//
// Shared by the /pr-self-review skill (to review + hash the diff) and the enforce
// hook (to recompute the hash and match it against the pass marker). READ-ONLY:
// it never mutates the index or the working tree.
//
// "All open changes" = everything between the integration base and the working
// tree: committed-on-branch + staged + unstaged, plus untracked files.
//
// Run directly for a JSON dump:  node diff.mjs [--with-diff]
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, statSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function git(args, { allowFail = false } = {}) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    if (allowFail) return null;
    throw err;
  }
}

// First ref that actually resolves becomes the integration base.
const INTEGRATION_CANDIDATES = ['origin/main', 'main', 'master', 'origin/master'];

function resolveIntegration() {
  for (const ref of INTEGRATION_CANDIDATES) {
    const out = git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { allowFail: true });
    if (out && out.trim()) return ref;
  }
  return null;
}

// Paths excluded from *skill review*. The silent-break gates still inspect these
// via the unfiltered changedFiles list (that's where drift / do-not-touch live).
export function isExcluded(file) {
  const p = String(file).replace(/\\/g, '/');
  return (
    p.startsWith('server/clones/') ||
    p.includes('/src/vendor/') ||
    p.startsWith('.next/') || p.includes('/.next/') ||
    p.startsWith('dist/') || p.includes('/dist/') ||
    p.startsWith('.git/')
  );
}

// `git diff --name-status` → [{ status, path }]. Renames ("R100\told\tnew") keep
// the new path; the leading letter (A/M/D/R…) is the status.
function parseNameStatus(text) {
  if (!text) return [];
  return text
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      const status = parts[0]?.[0] ?? '?';
      const path = parts.length >= 3 ? parts[2] : parts[1];
      return { status, path };
    })
    .filter((e) => e.path);
}

export function computeChangeSet() {
  const headSha = (git(['rev-parse', 'HEAD'], { allowFail: true }) || '').trim() || null;
  const integration = resolveIntegration();
  const warnings = [];

  let base = null;
  let baseSha = null;
  if (integration) {
    const mb = git(['merge-base', integration, 'HEAD'], { allowFail: true });
    if (mb && mb.trim()) {
      base = integration;
      baseSha = mb.trim();
    }
  }
  if (!baseSha) {
    warnings.push(
      'No integration branch (origin/main | main | master) found — reviewing working-tree changes vs HEAD only.',
    );
  }

  const diffTarget = baseSha || 'HEAD';
  const changedFiles = parseNameStatus(git(['diff', '--name-status', diffTarget], { allowFail: true }));
  const untracked = (git(['ls-files', '--others', '--exclude-standard'], { allowFail: true }) || '')
    .split('\n')
    .map((s) => s.replace(/\r$/, '').trim())
    .filter(Boolean)
    .filter((f) => !isExcluded(f));

  const diffText = git(['diff', diffTarget], { allowFail: true }) || '';

  // Hash the unified diff plus each untracked file's path + bytes (sorted), so a
  // brand-new file changes the hash even though it isn't in `git diff` yet.
  const hash = createHash('sha256');
  hash.update(diffText);
  for (const f of [...untracked].sort()) {
    hash.update(`\0U\0${f}\0`);
    try {
      if (existsSync(f) && statSync(f).isFile()) hash.update(readFileSync(f));
    } catch {
      /* unreadable — the path alone still perturbs the hash */
    }
  }
  const diffHash = hash.digest('hex');

  const reviewFiles = [
    ...changedFiles.filter((e) => e.status !== 'D' && !isExcluded(e.path)).map((e) => e.path),
    ...untracked,
  ];

  return {
    base,
    baseSha,
    headSha,
    empty: changedFiles.length === 0 && untracked.length === 0,
    changedFiles, // full, with status — for the silent-break gates
    untracked,
    reviewFiles, // filtered set the skill routes to skills
    diffText,
    diffHash,
    warnings,
  };
}

function isMainModule() {
  try {
    return Boolean(
      process.argv[1] &&
        realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)),
    );
  } catch {
    return false;
  }
}

if (isMainModule()) {
  const cs = computeChangeSet();
  const withDiff = process.argv.includes('--with-diff');
  const out = withDiff
    ? cs
    : { ...cs, diffText: `<${Buffer.byteLength(cs.diffText)} bytes, pass --with-diff to see>` };
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
}
