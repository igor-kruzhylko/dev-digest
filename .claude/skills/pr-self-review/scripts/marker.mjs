// marker.mjs — reads/writes the PR Self-Review state under <git-dir>/pr-self-review/.
// This is the coupling point between the skill (writes a clean marker) and the
// enforce hook (reads it to decide allow/deny). Stored under .git/ so it is
// per-clone, never committed, and wiped on a fresh clone (safe default).
//
//   node marker.mjs read
//   node marker.mjs pass --verdict approve --score 100 --critical 0 --warning 0 --suggestion 0
//   node marker.mjs clear
//   node marker.mjs last-review        # reads the full Review JSON from stdin
//   node marker.mjs override --reason "hotfix" [--command "git push"]
//   node marker.mjs dir
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, appendFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeChangeSet } from './diff.mjs';

export function markerDir() {
  const gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { encoding: 'utf8' }).trim();
  const dir = join(gitDir, 'pr-self-review');
  mkdirSync(dir, { recursive: true });
  return dir;
}
const passPath = () => join(markerDir(), 'pass.json');
const lastReviewPath = () => join(markerDir(), 'last-review.json');
const overridePath = () => join(markerDir(), 'override.log');

export function readMarker() {
  try {
    const p = passPath();
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}
export function writeMarker(obj) {
  writeFileSync(passPath(), `${JSON.stringify(obj, null, 2)}\n`);
}
export function clearMarker() {
  rmSync(passPath(), { force: true });
}
export function writeLastReview(obj) {
  writeFileSync(lastReviewPath(), `${JSON.stringify(obj, null, 2)}\n`);
}
export function appendOverride(entry) {
  appendFileSync(overridePath(), `${JSON.stringify(entry)}\n`);
}

function parseFlags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      out[key] = val;
    }
  }
  return out;
}
function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
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
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);

  switch (cmd) {
    case 'dir':
      process.stdout.write(`${markerDir()}\n`);
      break;

    case 'read': {
      const m = readMarker();
      process.stdout.write(`${JSON.stringify(m, null, 2)}\n`);
      break;
    }

    case 'pass': {
      const verdict = flags.verdict ?? 'approve';
      if (verdict === 'request_changes') {
        process.stderr.write('refusing to write a pass marker for verdict=request_changes\n');
        process.exit(2);
      }
      const cs = computeChangeSet();
      writeMarker({
        diffHash: cs.diffHash,
        verdict,
        score: Number(flags.score ?? 100),
        criticalCount: Number(flags.critical ?? 0),
        warningCount: Number(flags.warning ?? 0),
        suggestionCount: Number(flags.suggestion ?? 0),
        baseSha: cs.baseSha,
        headSha: cs.headSha,
        generatedAt: new Date().toISOString(),
      });
      process.stdout.write(`pass marker written (diffHash ${cs.diffHash.slice(0, 12)}…)\n`);
      break;
    }

    case 'clear':
      clearMarker();
      process.stdout.write('pass marker cleared\n');
      break;

    case 'last-review': {
      const raw = readStdin();
      try {
        writeLastReview(JSON.parse(raw));
        process.stdout.write('last-review.json written\n');
      } catch {
        process.stderr.write('last-review: invalid JSON on stdin\n');
        process.exit(1);
      }
      break;
    }

    case 'override': {
      const cs = computeChangeSet();
      appendOverride({
        time: new Date().toISOString(),
        reason: flags.reason ?? '(none)',
        diffHash: cs.diffHash,
        command: flags.command ?? null,
      });
      process.stdout.write('override recorded\n');
      break;
    }

    default:
      process.stderr.write('usage: marker.mjs <read|pass|clear|last-review|override|dir> [flags]\n');
      process.exit(1);
  }
}
