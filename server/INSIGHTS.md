# server — insights

Durable, non-obvious learnings for this module. Append-only, newest on top within each section.
Skip anything obvious from reading the code. Written by the `engineering-insights` skill.
Entry format: `- YYYY-MM-DD — <fact> / why it matters / how to apply (file:line)`

## What Works
<!-- approaches & solutions that worked -->

## What Doesn't Work
<!-- dead ends & antipatterns to avoid (highest-value section — don't skip it) -->
- 2026-06-29 — Do NOT add a REQUIRED field (or a `z.array(...).default([])`, whose zod OUTPUT type is required) to `PrMeta`: it is reused as the return type of the GitHub adapter (`listPullRequests`) and as the base of `PrDetail` (`getPullRequest` + the offline fallback in `pulls/routes.ts`), none of which can supply list-only data. Typecheck then breaks in `adapters/github/octokit.ts`, `adapters/mocks.ts`, and the PR-detail handler. List-endpoint-only fields must be optional — use `.nullish()` (matches `score`/`cost_usd`); the route fills it, everyone else omits it (server/src/vendor/shared/contracts/platform.ts:176). Remember to mirror the edit into BOTH vendored copies (server + client).
- 2026-06-21 — Do NOT use `` import.meta.url === `file://${process.argv[1]}` `` for CLI entrypoint detection — on Windows the URL forms never match, so `pnpm db:migrate` / `pnpm db:seed` exit 0 without running. Use `isDirectRun(import.meta.url)` from `server/src/db/is-direct-run.ts` (`pathToFileURL`); the caller must pass its own `import.meta.url`, not rely on the helper's.

## Codebase Patterns
<!-- conventions & architectural choices specific to this module -->
- 2026-06-29 — `ReviewService.deleteReview` deletes the WHOLE agent run when the review has a `run_id` (delegates to `deleteAgentRun`), not just the review row — otherwise the timeline run would linger with no findings while the list/accordion lose them, leaving the two surfaces inconsistent. It first loads the review and bails (`false`) if missing or cross-workspace. `deleteAgentRun` returns `true` if EITHER the reviews OR the `agent_runs` row was deleted (a review can outlive its run row), so callers don't 404 a successful partial cleanup (server/src/modules/reviews/service.ts:60, server/src/modules/reviews/repository/run.repo.ts:80).
- 2026-06-29 — `GET /repos/:id/pulls` now also returns `PrMeta.findings` (ALL findings across the PR's `kind='review'` runs), computed on read like `score`/`cost_usd` — one `findings ⨝ reviews` IN-query grouped per `pr_id` in JS, no denorm. Mirrors the detail page's flatten-across-runs. It's NOT filtered by accepted/dismissed (the list shows everything). Add list-only aggregates here, not as stored columns (server/src/modules/pulls/routes.ts:147).
- 2026-06-21 — Per-run LLM cost is already computed (`outcome.costUsd`, real `usage.cost` for OpenRouter) but `agent_runs.cost_usd` was DROPPED in migration `0009`, so the value was silently discarded in `run-executor`. Re-added the column (`0010`) and threaded `costUsd` → `completeAgentRun` + `trace.stats.cost_usd`. Store `null` (never `0`) for failed/cancelled/unknown so the UI shows "—" not "$0.00" (server/src/modules/reviews/run-executor.ts:213, server/src/modules/reviews/repository/run.repo.ts:141).
- 2026-06-21 — `completeAgentRun`'s param type is declared in TWO places: the thin wrapper class in `repository.ts` AND the impl in `repository/run.repo.ts`. Adding a field to one without the other fails typecheck with a confusing "does not exist in type" at the call site — edit both (server/src/modules/reviews/repository.ts:151).

## Tool & Library Notes
<!-- dependency quirks, version gotchas, flags -->

## Decisions
<!-- decisions with the reason behind them -->
- 2026-06-29 — Generalizes the 2026-06-22 cost-invalidation note: because the PR-list row is built from read-time aggregates (`cost_usd`, now `findings`), EVERY mutation that can change them must invalidate the `["pulls"]` query, else the list goes stale with no manual refresh. Now wired in `useDeleteReview`, `useRunReview`, and `useFindingAction` (plus the existing `useDeleteRun`). New list aggregate → audit which mutations touch it and add the `["pulls"]` invalidation (client/src/lib/hooks/reviews.ts).
- 2026-06-22 — PR list COST column (`PrMeta.cost_usd` from `GET /repos/:id/pulls`) is the SUM of `cost_usd` over ALL completed (`status='done'`) runs for the PR, NOT the latest run's cost (supersedes the 2026-06-21 latest-run choice). It is a read-time aggregate (JS sum over the same `IN` query, no `orderBy`/dedup), so deleting a run from the timeline subtracts its cost on the next fetch — no stored/denormalized total to drift. Skip runs with null/non-finite `cost_usd`; a PR with completed runs but no known cost stays `null` → UI renders "—". Because the total spans runs, `useDeleteRun` must also invalidate the `["pulls"]` query, not just `pr-runs`/`reviews` (server/src/modules/pulls/routes.ts:120, client/src/lib/hooks/reviews.ts:66).

## Recurring Errors & Fixes
<!-- errors that keep coming back + the fix -->
- 2026-06-21 — `column "cost_usd" does not exist` on PR list after pulling migration `0010` code — `0009` dropped the column but migrate never ran on Windows (silent CLI no-op). Fix: apply pending migrations (`pnpm db:migrate` must print `✓ migrations applied`; if silent, use `isDirectRun()` fix or `runMigrations()` directly). Verify: `SELECT COUNT(*) FROM drizzle.__drizzle_migrations` matches file count in `src/db/migrations/`.

## Session Notes
<!-- dated session summaries -->

## Open Questions
<!-- still unresolved -->
