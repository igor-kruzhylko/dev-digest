# PR Self-Review — INSIGHTS

Gotchas & decisions for the local pre-PR gate (skill + scripts + enforce hook).

## Decisions

- 2026-07-01 — Scripts + hook are Node `.mjs` (run as `node script.mjs`), not bash `.sh`. Why: Claude Code's hook-runner shell on Windows won't reliably execute `.sh`, and Node is already the repo's tooling language. How: mirror `server/scripts/arch.mjs` (`spawn(cmd, { shell: true })`, exit-code mirroring); the hook command is `node "${CLAUDE_PROJECT_DIR}/.claude/hooks/pr-self-review-enforce.mjs"` (`.claude/settings.json`).
- 2026-07-01 — Enforcement is **marker-gated**: the `/pr-self-review` skill (LLM) runs the gates + routed skills and writes a diff-hash pass marker under `<git-dir>/pr-self-review/pass.json`; the deterministic PreToolUse hook only *reads* it to allow/deny `git push` / `gh pr create` / `gh pr merge`. Why: a bash hook can't run the LLM review synchronously, so review (skill) and gate (hook) are separated; the marker doubles as the "unchanged diff → instant no-op" cache. How: skill and hook both derive the hash from the same `scripts/diff.mjs`, so they never disagree (`scripts/marker.mjs`, `.claude/hooks/pr-self-review-enforce.mjs`).
- 2026-07-01 — Hook registers with `matcher: "Bash"` + in-script command filtering, not the settings `if: "Bash(git push *)"` glob. Why: the `if` glob syntax is version-sensitive; if it silently fails to match, the *safety gate would not fire at all* (worse than a little overhead). How: the script's first step is `isGatedCommand()`; non-gated commands `exit 0` immediately (`.claude/hooks/pr-self-review-enforce.mjs:15`).
- 2026-07-01 — Level-1 enforcement only (Claude Code hook). A native git `pre-push` hook (Level 2, covers terminal pushes) is deferred — a native hook can enforce gates+marker but can't run the LLM skill review.

## What Works

- 2026-07-01 — Isolation-test a PreToolUse hook by piping crafted stdin before registering it: `echo '{"tool_input":{"command":"git push"}}' | node .claude/hooks/pr-self-review-enforce.mjs`. Why: proves allow / deny / stale / override paths without risking git in the live session. Cover: non-git (allow), no-marker (deny), valid-marker (allow), stale-marker (deny), override (allow+log).

## What Doesn't Work

- 2026-07-01 — The Bash tool's working directory **persists across calls**: a `cd reviewer-core` in one call made later relative `node .claude/...` paths resolve under `reviewer-core/` → `MODULE_NOT_FOUND`. How to avoid: run repo tooling from the repo root (prefix `cd <repo-root>`) or use absolute paths.

## Codebase Patterns

- 2026-07-01 — Product parity is reused verbatim so the local result predicts the cloud PR review: Finding/Review shape (`server/src/vendor/shared/contracts/findings.ts` — severity `CRITICAL|WARNING|SUGGESTION`, verdict `request_changes|approve|comment`), score `100 − 35·C − 12·W − 3·S` (`reviewer-core/src/review/reduce.ts` `scoreFromFindings`), grounding = drop findings not intersecting a changed hunk (`reviewer-core/src/grounding.ts`).
- 2026-07-01 — Silent-break gates encode repo gotchas deterministically (`scripts/silent-breaks.mjs`): vendored-contract drift (server↔client `src/vendor/shared` must be byte-identical), schema-without-migration (`server/src/db/schema*` changed but no new `migrations/NNNN_*.sql` + `meta/_journal.json` bump), i18n missing key (`client/messages/en/<ns>.json` vs a new `t("ns.key")`). i18n messages live at `client/messages/<locale>/`, not `client/src/messages/`.

## Tool & Library Notes

- 2026-07-01 — PreToolUse hook must **fail-open**: wrap the whole hook in try/catch and `exit 0` on any internal error; only a definite "no valid marker / stale / request_changes" emits `permissionDecision: "deny"`. Why: a throwing hook would otherwise block every gated git op (`.claude/hooks/pr-self-review-enforce.mjs`).
- 2026-07-01 — Deny via stdout JSON `{ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason, additionalContext } }` with `exit 0` works; the reason + additionalContext are surfaced back to Claude. `${CLAUDE_PROJECT_DIR}` expands in the hook command. Git Bash on Windows bundles `jq` and Node v25.
- 2026-07-01 — Untracked files aren't in `git diff`, so the change set/hash adds them separately (`git ls-files --others --exclude-standard` + hashing their bytes); the index is never mutated (`scripts/diff.mjs`).

## Recurring Errors & Fixes

- 2026-07-01 — `reviewer-core` `npm test` fails on `feat/lesson-02`: `test/run.test.ts` → `../server/src/adapters/mocks.ts` imports `@devdigest/reviewer-core`, which vitest can't resolve ("Cannot find package '@devdigest/reviewer-core'"). Pre-existing branch issue (cross-package alias not resolved in reviewer-core's vitest config) — the gate correctly surfaces it as CRITICAL. Fix the alias/import before merging.

## Session Notes

- 2026-07-01 — Built PR Self-Review end-to-end: `/pr-self-review` skill + 4 scripts (`diff` / `gates` / `silent-breaks` / `marker` `.mjs`) + PreToolUse `enforce.mjs` hook + committed `.claude/settings.json`. Staged as docs → specs → execution plan → build, each reviewed. Every script verified individually; hook verified **live** (a probe `echo "… git push"` was blocked through the real Claude Code hook). Docs/spec at `docs/pr-self-review.md`, `specs/pr-self-review.md`.

## Open Questions

- 2026-07-01 — Should the migration-drift gate distinguish SQL-affecting schema edits from pure comment/type-only edits to cut false positives? Currently any `schema*` change without a migration is CRITICAL (overridable).
- 2026-07-01 — Level-2 native `pre-push` hook (terminal-push coverage) not yet built — worth it only if pushes commonly happen outside Claude Code.
