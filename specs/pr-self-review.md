# PR Self-Review — spec

Implementation of the pre-PR gate described in `docs/pr-self-review.md`. Two
committed pieces — a `/pr-self-review` **skill** (the reviewer) and a `PreToolUse`
**hook** (the gate) — coordinated by a diff-hash **pass marker** under `.git/`.
Findings, score, and verdict reuse the product's own contracts, so the local
result mirrors what the cloud PR review would return.

Enforcement reach is **Level 1** (Claude Code hook only): the gate covers git/gh
commands run through Claude Code. A native git pre-push hook for terminal pushes
(Level 2) is out of scope here and noted below.

## Components

- **Skill** — `.claude/skills/pr-self-review/SKILL.md` (+ `scripts/`). Runs the
  full review inline and writes the pass marker on a clean result.
- **Hook** — `.claude/hooks/pr-self-review-enforce.mjs`, registered in
  `.claude/settings.json` (committed, team-shared). Blocks gated GitHub ops unless
  a matching clean marker exists.
- **State** — `.git/pr-self-review/`: `pass.json` (clean marker + last-clean
  cache), `last-review.json` (full Review for reference), `override.log` (audit
  trail). `.git/` is per-clone, never committed, and wiped on a fresh clone — so a
  new clone must review before it can push (safe default).
- **Shared gate scripts** — `.claude/skills/pr-self-review/scripts/`:
  `diff.mjs`, `gates.mjs`, `silent-breaks.mjs`, `marker.mjs` (Node — cross-platform,
  matching `server/scripts/arch.mjs`). Callable by the skill now and by the
  Level-2 native hook later.

## Change set — what "all open changes" means

- **Base**: `BASE = git merge-base <INTEGRATION> HEAD`, where `<INTEGRATION>` is
  `origin/main` if it exists, else local `main` / `master`. If `HEAD == BASE` (on
  the integration branch, or no branch commits yet) there is nothing to review.
- **Reviewed diff**: `git diff <BASE>` — captures committed-on-branch + staged +
  unstaged in one pass. Untracked files
  (`git ls-files --others --exclude-standard`) are listed and their contents
  included separately. The index is never mutated.
- **Changed file set**: `git diff --name-only <BASE>` ∪ untracked.
- **Exclusions from *skill* review**: `server/clones/**`, `**/src/vendor/**`, and
  build output (`.next/**`, `dist/**`). Vendored and cloned paths are still
  inspected by the drift and do-not-touch gates below.

## Diff hash & pass marker

- `diffHash = sha256( git diff <BASE>  ⧺  sorted(untracked file contents) )`.
- `.git/pr-self-review/pass.json`:

  ```json
  {
    "diffHash": "…",
    "verdict": "approve | comment",
    "score": 100,
    "criticalCount": 0,
    "warningCount": 0,
    "suggestionCount": 0,
    "baseSha": "…",
    "headSha": "…",
    "generatedAt": "2026-07-01T00:00:00Z"
  }
  ```

- Written **only** when `verdict != 'request_changes'` (zero Critical). On a
  Critical result, any stale marker is removed and `last-review.json` holds the
  full Review.
- Any change to the working tree changes `diffHash`, invalidating the marker and
  forcing a re-review.

## File routing → skills

Only the skills whose surface appears in the changed set are loaded, and only the
changed hunks (plus minimal context) are reviewed.

| Surface | Paths | Skills applied |
|---|---|---|
| UI / frontend | `client/**` (`.tsx`, `.ts`, styles) | frontend-ui-architecture · next-best-practices · react-best-practices · react-testing-library |
| Backend / domain | `server/src/**`, `reviewer-core/src/**` (`.ts`) | onion-architecture · fastify-best-practices · drizzle-orm-patterns · postgresql-table-design |
| Cross-cutting | either surface | typescript-expert · zod · security |
| Excluded | `server/clones/**`, `**/src/vendor/**`, build output | none — drift / do-not-touch gates only |

## Deterministic gates (per touched package, run in parallel)

Detect the touched packages from the changed paths, then run only those. Lives in
`scripts/gates.mjs`.

- **client** → `pnpm -C client typecheck` + `pnpm -C client test`
- **server** → `pnpm -C server typecheck` + `pnpm -C server run arch`
  + `pnpm -C server exec vitest run --exclude '**/*.it.test.ts'`
- **reviewer-core** → `npm --prefix reviewer-core run typecheck`
  + `npm --prefix reviewer-core test` (+ `npm --prefix reviewer-core run arch`)

Any non-zero exit becomes a **Critical** finding whose `source` is the gate id and
whose `rationale` captures the failing output tail.

## Silent-break gates

Lives in `scripts/silent-breaks.mjs`.

- **Contract drift** → **Critical**. For each changed file under
  `server/src/vendor/shared/**` (or the `client/…` copy), the counterpart copy must
  be byte-identical:
  `diff -q server/src/vendor/shared/<rel> client/src/vendor/shared/<rel>`.
  Any mismatch on a touched vendor file is drift. (No auto-sync exists; the copies
  are the single source of truth for cross-package contracts.)
- **Migration drift** → **Critical**. If any changed path matches
  `server/src/db/schema.ts` or `server/src/db/schema/**`, the change set must also
  add a new `server/src/db/migrations/NNNN_*.sql` and bump
  `server/src/db/migrations/meta/_journal.json`. Otherwise Critical: "schema
  changed, no migration — run `pnpm -C server db:generate`". This is a heuristic and
  is overridable for pure-comment / type-only schema edits.
- **i18n completeness** → **Warning** (never blocks). In changed `client/**` files:
  a new `t("ns.key")` whose key is absent from `client/messages/en/<ns>.json`
  (missing key), or a new user-facing JSX text literal added without a `t()` wrapper
  (hardcoded string). Best-effort heuristic; `en` is the only locale today.

## Findings, verdict, and score (product parity)

- Findings use the repo's `Finding` shape
  (`server/src/vendor/shared/contracts/findings.ts`): `severity`, `title`, `file`,
  `start_line`, `end_line`, `rationale` (markdown), `suggestion` (the fix hint,
  markdown), `confidence` — plus a local `source` tag (skill name or gate id).
- **Grounding** — mirrors `groundFindings` (`reviewer-core/src/grounding.ts`):
  every skill-derived finding must cite a real `file:line` inside a changed hunk of
  the reviewed diff, or it is dropped. Gate findings cite the gate and the relevant
  file(s).
- **Anti-inflation** — speculative issues ("might be", "if not already handled") are
  at most Warning. No duplicate findings; no target count (zero is a good result).
- **Score** — `scoreFromFindings` (`reviewer-core/src/review/reduce.ts`):
  `clamp(0, 100, 100 − Σ penalty)` with Critical 35 / Warning 12 / Suggestion 3.
  Recomputed from the grounded findings, never taken from a model's self-report.
- **Verdict** — `request_changes` iff ≥ 1 Critical; `comment` iff only non-blocking
  findings; `approve` iff no findings. Block threshold is `critical`, matching the
  product's `agents.ciFailOn` default.

## The `/pr-self-review` skill (reviewer)

`SKILL.md` frontmatter: `name: pr-self-review`; a `description` with trigger phrases
("self-review", "before push / before opening a PR", "review my local changes");
`user-invocable: true`; `allowed-tools: Read, Grep, Glob, Bash(node *), Bash(git *)`.
It runs **inline** so the user sees the report.

Procedure:

1. Compute BASE + reviewed diff + changed set (`scripts/diff.mjs`).
2. Empty set → `approve`, write the pass marker, stop.
3. Run the deterministic gates for the touched packages (`scripts/gates.mjs`), in
   parallel.
4. Run the silent-break gates (`scripts/silent-breaks.mjs`).
5. Route the changed files to skills; apply each routed skill to the changed hunks
   to produce grounded findings.
6. Aggregate findings; recompute score; derive verdict.
7. Print the report.
8. If `verdict != request_changes`, write `pass.json`. Otherwise remove any stale
   marker, write `last-review.json`, and state that push / PR is blocked until
   fixed.

### Invocation

- **Manual (primary for ad-hoc use)** — type `/pr-self-review` at any time. Claude
  Code maps the skill directory name to that slash command, and `user-invocable:
  true` keeps it in the `/` menu. It runs against whatever is currently open, so it
  is useful for early feedback and not only at push time. It is side-effect-free
  except for writing or refreshing `.git/pr-self-review/pass.json` on a clean
  result.
- **Automatic (assist)** — the `description` auto-loads the skill when you ask to
  push, open a PR, or "review my changes".
- **Enforcement is separate** — the PreToolUse hook only *blocks*; the skill only
  *reviews*. A clean manual `/pr-self-review` is exactly what writes the marker that
  lets the next push through, so the hook never has to fire for you to run a review.

## The PreToolUse hook (gate)

Registered in `.claude/settings.json` (committed):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/hooks/pr-self-review-enforce.mjs\"",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

`pr-self-review-enforce.mjs` reads the stdin JSON and:

1. Parses `tool_input.command`. If it is not a gated op (`git push`,
   `gh pr create`, `gh pr merge`) → `exit 0` immediately, so unrelated Bash calls
   carry no overhead.
2. **Override** — if the command carries `DEVDIGEST_PR_OVERRIDE="<reason>"`, append
   `{ time, reason, diffHash, command }` to `.git/pr-self-review/override.log` and
   `exit 0` (allow this one command).
3. Recompute `diffHash` (`scripts/diff.mjs`); read `pass.json`.
4. **Allow** (`exit 0`) iff the marker exists **and** `marker.diffHash == diffHash`
   **and** `marker.verdict != request_changes`.
5. Otherwise **block** with:

   ```json
   {
     "hookSpecificOutput": {
       "hookEventName": "PreToolUse",
       "permissionDecision": "deny",
       "permissionDecisionReason": "PR Self-Review required — N CRITICAL(s), or the diff changed since the last clean review.",
       "additionalContext": "Run /pr-self-review, resolve criticals, then retry."
     }
   }
   ```

The hook fires for all git/gh commands run through Claude Code (agent- or
assistant-initiated). Terminal-only pushes bypass it — that is the Level-1
boundary.

## Report format

```
PR Self-Review — <verdict> · score <N>/100 · <C> critical · <W> warning · <S> suggestion  [BLOCKED|OK]

CRITICAL
  <file>:<line> — <title>            (source: <skill|gate>)
      <rationale>
      fix: <suggestion>
WARNING / SUGGESTION …                (always listed, even on a pass)

Gates: typecheck ✓ · arch ✓ · unit ✓ · contract-drift ✓ · migration ✓ · i18n ⚠
<blocked> Resolve the CRITICAL(s), then re-run /pr-self-review.
<ok>      Clean — pass marker written; push / PR allowed.
```

Non-blocking findings are always listed. The full Review is also persisted to
`.git/pr-self-review/last-review.json` for tooling.

## Override

`DEVDIGEST_PR_OVERRIDE="<reason>" git push …` — the hook allows that single command
and appends an entry to `.git/pr-self-review/override.log`. It is deliberate (the
reason must be supplied) and auditable, and it applies only to that one invocation.

## Edge cases

- On the integration branch (`HEAD == BASE`): nothing to review; the skill says so
  and the hook allows.
- No `origin/main`: fall back to local `main` / `master`; if none exists, treat the
  tracked files as the change set and warn.
- Editing `server/clones/**` → **Critical** (do-not-touch); committing build output →
  **Warning**. Vendored `src/vendor/shared` edits are allowed when synced — only drift
  (the copies differ) is **Critical**.
- Untracked new files are included in the review and the hash without mutating the
  index.
- A stale marker (any diff change) → hash mismatch → re-review required.

## Out of scope

- **Native git pre-push hook / terminal-push coverage (Level 2)** — a documented
  future extension; not built now.
- Integration / e2e suites and full-stack boot — left to CI.
- Multi-locale i18n (only `en` exists today).
- Auto-fixing or rewriting code.
- Changing the product's severity / score / verdict definitions.

## Verification

- **Onion violation** — make a `server/` service import Drizzle, run
  `/pr-self-review`, and expect a Critical from `pnpm -C server run arch`, verdict
  `request_changes`, and no marker; a Claude-run `git push` is then denied by the
  hook.
- **Contract drift** — edit only
  `server/src/vendor/shared/contracts/findings.ts` and expect a drift Critical.
- **Migration drift** — change `server/src/db/schema/*.ts` with no migration and
  expect a Critical; run `pnpm -C server db:generate` and re-review clean.
- **i18n** — add `t("x.y")` with no key in `client/messages/en/<ns>.json` and expect
  a Warning, with push still allowed.
- **Clean path** — a clean diff yields `approve` and writes the marker; a second
  `git push` with no changes is allowed instantly (no re-review).
- **Override** — `DEVDIGEST_PR_OVERRIDE="hotfix" git push` is allowed and appends to
  `override.log`.
