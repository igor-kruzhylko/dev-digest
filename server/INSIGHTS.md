# server — insights

Durable, non-obvious learnings for this module. Append-only, newest on top within each section.
Skip anything obvious from reading the code. Written by the `engineering-insights` skill.
Entry format: `- YYYY-MM-DD — <fact> / why it matters / how to apply (file:line)`

## What Works
<!-- approaches & solutions that worked -->

## What Doesn't Work
<!-- dead ends & antipatterns to avoid (highest-value section — don't skip it) -->
- 2026-06-21 — Do NOT use `` import.meta.url === `file://${process.argv[1]}` `` for CLI entrypoint detection — on Windows the URL forms never match, so `pnpm db:migrate` / `pnpm db:seed` exit 0 without running. Use `isDirectRun(import.meta.url)` from `server/src/db/is-direct-run.ts` (`pathToFileURL`); the caller must pass its own `import.meta.url`, not rely on the helper's.

## Codebase Patterns
<!-- conventions & architectural choices specific to this module -->
- 2026-06-21 — Per-run LLM cost is already computed (`outcome.costUsd`, real `usage.cost` for OpenRouter) but `agent_runs.cost_usd` was DROPPED in migration `0009`, so the value was silently discarded in `run-executor`. Re-added the column (`0010`) and threaded `costUsd` → `completeAgentRun` + `trace.stats.cost_usd`. Store `null` (never `0`) for failed/cancelled/unknown so the UI shows "—" not "$0.00" (server/src/modules/reviews/run-executor.ts:213, server/src/modules/reviews/repository/run.repo.ts:141).
- 2026-06-21 — `completeAgentRun`'s param type is declared in TWO places: the thin wrapper class in `repository.ts` AND the impl in `repository/run.repo.ts`. Adding a field to one without the other fails typecheck with a confusing "does not exist in type" at the call site — edit both (server/src/modules/reviews/repository.ts:151).

## Tool & Library Notes
<!-- dependency quirks, version gotchas, flags -->

## Decisions
<!-- decisions with the reason behind them -->
- 2026-06-22 — PR list COST column (`PrMeta.cost_usd` from `GET /repos/:id/pulls`) is the SUM of `cost_usd` over ALL completed (`status='done'`) runs for the PR, NOT the latest run's cost (supersedes the 2026-06-21 latest-run choice). It is a read-time aggregate (JS sum over the same `IN` query, no `orderBy`/dedup), so deleting a run from the timeline subtracts its cost on the next fetch — no stored/denormalized total to drift. Skip runs with null/non-finite `cost_usd`; a PR with completed runs but no known cost stays `null` → UI renders "—". Because the total spans runs, `useDeleteRun` must also invalidate the `["pulls"]` query, not just `pr-runs`/`reviews` (server/src/modules/pulls/routes.ts:120, client/src/lib/hooks/reviews.ts:66).

## Recurring Errors & Fixes
<!-- errors that keep coming back + the fix -->
- 2026-06-21 — `column "cost_usd" does not exist` on PR list after pulling migration `0010` code — `0009` dropped the column but migrate never ran on Windows (silent CLI no-op). Fix: apply pending migrations (`pnpm db:migrate` must print `✓ migrations applied`; if silent, use `isDirectRun()` fix or `runMigrations()` directly). Verify: `SELECT COUNT(*) FROM drizzle.__drizzle_migrations` matches file count in `src/db/migrations/`.

## Session Notes
<!-- dated session summaries -->

## Open Questions
<!-- still unresolved -->
