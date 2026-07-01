// silent-breaks.mjs — deterministic detection of this repo's known "silent
// breaks" that a per-file skill review would miss. Emits findings in the same
// shape the skill uses. READ-ONLY.
//
//   - Vendored-contract drift  -> CRITICAL (copies must be byte-identical)
//   - Schema change, no migration -> CRITICAL (migrations don't run on boot)
//   - Edit under server/clones/** -> CRITICAL (third-party, never touch)
//   - Committed build output      -> WARNING
//   - New t("ns.key") with no message key -> WARNING (i18n completeness)
//
// Run directly for a JSON dump:  node silent-breaks.mjs
import { readFileSync, existsSync } from 'node:fs';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { computeChangeSet } from './diff.mjs';

const norm = (p) => String(p).replace(/\\/g, '/');

// Parse a unified diff into added lines per file, with their new-file line
// numbers — used to scope the i18n check to *newly added* code.
function addedLinesByFile(diffText) {
  const map = new Map();
  let file = null;
  let newLine = 0;
  for (const raw of diffText.split('\n')) {
    if (raw.startsWith('+++ ')) {
      const m = raw.match(/^\+\+\+ b\/(.*)$/);
      file = m ? m[1] : null;
      continue;
    }
    if (raw.startsWith('@@')) {
      const m = raw.match(/\+(\d+)/);
      newLine = m ? parseInt(m[1], 10) : 0;
      continue;
    }
    if (!file) continue;
    if (raw.startsWith('+') && !raw.startsWith('+++')) {
      if (!map.has(file)) map.set(file, []);
      map.get(file).push({ line: newLine, text: raw.slice(1) });
      newLine++;
    } else if (raw.startsWith('-') && !raw.startsWith('---')) {
      // deletion — does not advance the new-file cursor
    } else if (!raw.startsWith('\\')) {
      newLine++; // context line
    }
  }
  return map;
}

function finding(severity, source, file, title, rationale, suggestion, opts = {}) {
  return {
    severity,
    source,
    file,
    start_line: opts.line ?? 1,
    end_line: opts.line ?? 1,
    title,
    rationale,
    suggestion,
    confidence: opts.confidence ?? 1,
  };
}

// --- vendored-contract drift ------------------------------------------------
function contractDrift(changed) {
  const out = [];
  const seen = new Set();
  for (const e of changed) {
    if (e.status === 'D') continue;
    const p = norm(e.path);
    if (!p.includes('/src/vendor/shared/')) continue;

    let counterpart = null;
    if (p.startsWith('server/src/vendor/shared/')) {
      counterpart = p.replace('server/src/vendor/shared/', 'client/src/vendor/shared/');
    } else if (p.startsWith('client/src/vendor/shared/')) {
      counterpart = p.replace('client/src/vendor/shared/', 'server/src/vendor/shared/');
    } else {
      continue;
    }

    const key = [p, counterpart].sort().join('::');
    if (seen.has(key)) continue;
    seen.add(key);

    const a = existsSync(p) ? readFileSync(p) : null;
    const b = existsSync(counterpart) ? readFileSync(counterpart) : null;
    if (a === null || b === null || !a.equals(b)) {
      out.push(
        finding(
          'CRITICAL',
          'contract-drift',
          p,
          'Vendored shared contract is out of sync',
          `\`${p}\` differs from its vendored counterpart \`${counterpart}\`. The shared contracts are hand-vendored with no sync script, so every copy must be updated identically or the packages disagree at runtime.`,
          `Apply the same change to \`${counterpart}\` so both vendored copies are byte-identical.`,
        ),
      );
    }
  }
  return out;
}

// --- schema change without a migration --------------------------------------
function migrationDrift(changed) {
  const schemaChanged = changed.some((e) => {
    const p = norm(e.path);
    return e.status !== 'D' && (p === 'server/src/db/schema.ts' || p.startsWith('server/src/db/schema/'));
  });
  if (!schemaChanged) return [];

  const migrationAdded = changed.some((e) => {
    const p = norm(e.path);
    return e.status === 'A' && /^server\/src\/db\/migrations\/\d+_.*\.sql$/.test(p);
  });
  const journalTouched = changed.some(
    (e) => norm(e.path) === 'server/src/db/migrations/meta/_journal.json',
  );
  if (migrationAdded && journalTouched) return [];

  return [
    finding(
      'CRITICAL',
      'migration-drift',
      'server/src/db/schema',
      'Schema changed without a generated migration',
      'Files under `server/src/db/schema` changed but no new `server/src/db/migrations/NNNN_*.sql` (with a `meta/_journal.json` bump) was added. Migrations do not run on boot, so the database will drift from the schema and boot will fail with `relation … does not exist`.',
      'Run `pnpm -C server db:generate` and include the generated migration. (A pure-comment / type-only schema edit can override with `DEVDIGEST_PR_OVERRIDE`.)',
      { confidence: 0.9 },
    ),
  ];
}

// --- do-not-touch + build output --------------------------------------------
function doNotTouch(changed) {
  const out = [];
  for (const e of changed) {
    const p = norm(e.path);
    if (p.startsWith('server/clones/')) {
      out.push(
        finding(
          'CRITICAL',
          'do-not-touch',
          p,
          'Edit to a cloned third-party repo',
          '`server/clones/**` holds the third-party repos under review (the app\'s input data). It must never be edited.',
          `Revert changes under \`server/clones/\` — restore \`${p}\`.`,
        ),
      );
    } else if (/(^|\/)(\.next|dist)\//.test(p) && e.status !== 'D') {
      out.push(
        finding(
          'WARNING',
          'build-output',
          p,
          'Build output committed',
          `\`${p}\` looks like generated build output and should not be tracked.`,
          'Remove it from the change set and ensure it is git-ignored.',
        ),
      );
    }
  }
  return out;
}

// --- i18n completeness (missing message key) --------------------------------
const nsCache = new Map();
function loadNamespace(ns) {
  if (nsCache.has(ns)) return nsCache.get(ns);
  const file = `client/messages/en/${ns}.json`;
  let data = null;
  try {
    if (existsSync(file)) data = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    data = null;
  }
  nsCache.set(ns, data);
  return data;
}
function hasPath(obj, dotted) {
  let cur = obj;
  for (const part of dotted.split('.')) {
    if (cur && typeof cur === 'object' && Object.prototype.hasOwnProperty.call(cur, part)) cur = cur[part];
    else return false;
  }
  return true;
}
function i18nGaps(changed, added) {
  const out = [];
  const changedSet = new Set(changed.filter((e) => e.status !== 'D').map((e) => norm(e.path)));
  for (const [file, lines] of added) {
    const p = norm(file);
    if (!changedSet.has(p)) continue;
    if (!p.startsWith('client/')) continue;
    if (!/\.(tsx|ts)$/.test(p) || /\.(test|spec)\.(tsx|ts)$/.test(p)) continue;

    let content = '';
    try {
      content = existsSync(p) ? readFileSync(p, 'utf8') : '';
    } catch {
      continue;
    }
    const namespaces = [
      ...content.matchAll(/(?:useTranslations|getTranslations)\(\s*['"`]([^'"`]+)['"`]\s*\)/g),
    ].map((m) => m[1]);
    if (namespaces.length === 0) continue;

    for (const { line, text } of lines) {
      for (const m of text.matchAll(/\bt\(\s*['"`]([^'"`]+)['"`]/g)) {
        const key = m[1];
        const present = namespaces.some((ns) => {
          const data = loadNamespace(ns);
          return data && hasPath(data, key);
        });
        if (!present) {
          out.push(
            finding(
              'WARNING',
              'i18n',
              p,
              `Missing i18n message key: "${key}"`,
              `A \`t("${key}")\` call was added but the key is not present in any declared namespace (${namespaces
                .map((n) => `\`client/messages/en/${n}.json\``)
                .join(', ')}).`,
              `Add "${key}" to the appropriate \`client/messages/en/<namespace>.json\`.`,
              { line, confidence: 0.7 },
            ),
          );
        }
      }
    }
  }
  return out;
}

export function runSilentBreaks(changeSet = computeChangeSet()) {
  const { changedFiles, diffText } = changeSet;
  const added = addedLinesByFile(diffText || '');
  return [
    ...contractDrift(changedFiles),
    ...migrationDrift(changedFiles),
    ...doNotTouch(changedFiles),
    ...i18nGaps(changedFiles, added),
  ];
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
  const findings = runSilentBreaks();
  process.stdout.write(`${JSON.stringify(findings, null, 2)}\n`);
}
