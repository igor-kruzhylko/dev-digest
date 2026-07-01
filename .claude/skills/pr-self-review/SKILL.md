---
name: pr-self-review
description: >-
  Local pre-PR self-review for DevDigest. Reviews all open local changes (branch
  vs main + working tree) BEFORE they reach GitHub: routes UI files to the
  frontend skills and backend files to the onion/backend skills, runs the
  deterministic gates (typecheck, dependency-cruiser arch, vitest) and this repo's
  silent-break gates (vendored-contract drift, schema-without-migration, i18n
  gaps), grounds and scores the findings exactly like the cloud PR review, and
  writes a pass marker that the enforce hook checks. Use before `git push`, before
  `gh pr create` / `gh pr merge`, before opening a pull request, or any time you
  want to review local changes. Trigger phrases: "pr self review", "self-review",
  "review my changes before pushing", "check before I open a PR", "is this safe to
  push".
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash(node *), Bash(git *)
---

# PR Self-Review

A local mirror of DevDigest's cloud PR review. It reviews the **open changes** with
the project's own skills plus deterministic gates, classifies findings on the same
`CRITICAL | WARNING | SUGGESTION` scale, and **blocks** GitHub-bound git ops on any
`CRITICAL` by controlling a pass marker under `.git/pr-self-review/`.

Only `CRITICAL` blocks. `WARNING` / `SUGGESTION` are advisory.

Scripts live in `.claude/skills/pr-self-review/scripts/` and are read-only toward the
repo (they never write source, run migrations, or touch the index). Run them with
`node` from the **repo root**.

## Procedure

Follow these steps in order.

**ALWAYS**
- Run both gate scripts before assembling findings, even when the qualitative pass
  looks clean — they are the source of truth for mechanical failures.
- Ground every skill finding against a real, changed `file:line` before it reaches
  the report.
- Write a marker that matches the actual verdict.

**NEVER**
- Skip a gate because the diff looks small or safe.
- Report a finding you can't cite as a changed `file:line` in the diff.
- Write a `pass` marker while any `CRITICAL` finding is open, or invent findings to
  hit a target count — zero findings is a good result.

### 1. Scope the change set
Run `node .claude/skills/pr-self-review/scripts/diff.mjs`.
- If `empty` is `true`: report "Nothing to review", run
  `node .claude/skills/pr-self-review/scripts/marker.mjs pass --verdict approve --score 100`,
  and stop.
- Otherwise note `reviewFiles` (what you review), `changedFiles`, `diffHash`, and any
  `warnings` (e.g. no integration branch found — surface it).

### 2. Run the deterministic gates
Run both and collect their `findings` (each is already shaped as a finding):
- `node .claude/skills/pr-self-review/scripts/gates.mjs` — per-package typecheck /
  arch / unit tests. **Slow** — you may run it with `run_in_background: true` and
  collect the result after step 3.
- `node .claude/skills/pr-self-review/scripts/silent-breaks.mjs` — contract drift,
  migration drift, do-not-touch, i18n.

### 3. Route and review (the qualitative pass)
For each path in `reviewFiles`, pick its surface from the table below, then **read
the changed hunks** (`git diff <base> -- <file>`, where `<base>` is `diff.mjs`'s
`base`) and evaluate them against the guidance in each routed skill's
`.claude/skills/<skill>/SKILL.md`. **ALWAYS** raise a finding only where a
**changed line** breaks a rule — **NEVER** flag pre-existing code the diff didn't
touch.

| Surface | Paths | Apply these skills |
|---|---|---|
| UI / frontend | `client/**` (`.tsx`, `.ts`, styles) | frontend-ui-architecture · next-best-practices · react-best-practices · react-testing-library |
| Backend / domain | `server/src/**`, `reviewer-core/src/**` (`.ts`) | onion-architecture · fastify-best-practices · drizzle-orm-patterns · postgresql-table-design |
| Cross-cutting | either surface | typescript-expert · zod · security |

Load only the skills whose surface actually appears in `reviewFiles`. **NEVER**
review `server/clones/**`, `**/src/vendor/**`, or build output in this pass — the
silent-break gates already handle those.

### 4. Ground, then assemble
- **ALWAYS ground:** drop any skill finding whose `file` + line range does not
  intersect a changed hunk in the diff. If you can't cite a real changed `file:line`,
  it is not a finding.
- **NEVER inflate:** speculative issues ("might be", "if not already handled") are at
  most `WARNING`, never `CRITICAL`. No duplicates. There is no target count — zero
  findings is a good result.
- Combine gate findings + silent-break findings + grounded skill findings. Each finding
  has: `severity`, `title`, `file`, `start_line`, `end_line`, `rationale`, `suggestion`
  (the fix hint), `source` (the skill or gate that raised it).
- **Score** = `clamp(0, 100, 100 − 35·CRITICAL − 12·WARNING − 3·SUGGESTION)`.
- **Verdict** = `request_changes` if ≥1 CRITICAL, else `comment` if any findings, else
  `approve`.

### 5. Report
Print exactly this shape (worst severity first; non-blocking findings always shown):

```
PR Self-Review — <verdict> · score <N>/100 · <C> critical · <W> warning · <S> suggestion  [BLOCKED | OK]

CRITICAL
  <file>:<line> — <title>            (source: <skill|gate>)
      <rationale>
      fix: <suggestion>
WARNING
  …
SUGGESTION
  …

Gates: typecheck <✓/✗> · arch <✓/✗> · unit <✓/✗> · contract-drift <✓/✗> · migration <✓/✗> · i18n <✓/⚠>
```
End with one line: if blocked, `Blocked — resolve the CRITICAL(s), then re-run /pr-self-review.`
If clean, `Clean — pass marker written; push / PR allowed.`

### 6. Marker
**NEVER** write `pass` when the verdict is `request_changes`, or `clear` when it
isn't — the marker must match the verdict exactly.
- **Clean** (verdict `approve` or `comment`):
  `node .claude/skills/pr-self-review/scripts/marker.mjs pass --verdict <verdict> --score <N> --critical 0 --warning <W> --suggestion <S>`
- **Blocked** (verdict `request_changes`):
  `node .claude/skills/pr-self-review/scripts/marker.mjs clear`
  Then tell the user push/PR is blocked until the CRITICAL(s) are fixed and the review
  re-run.
- Optionally persist the full review for tooling by piping the review JSON to
  `node .claude/skills/pr-self-review/scripts/marker.mjs last-review`.

## Notes
- The pass marker is keyed to the exact `diffHash`. Any further edit invalidates it and
  requires a re-review — this is what makes an unchanged re-push an instant no-op.
- **Override** (rare, audited): `DEVDIGEST_PR_OVERRIDE="<reason>" git push …` lets one
  command through and is logged to `.git/pr-self-review/override.log`.
- The enforce hook (`.claude/hooks/pr-self-review-enforce.mjs`) only *reads* the marker
  to allow/deny `git push` / `gh pr create` / `gh pr merge`. This skill is what
  *produces* the marker — running it clean is what unblocks the next push.
