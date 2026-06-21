# Run Cost Badge — server spec

Persist and expose the per-run USD cost the LLM layer already computes, so the
client can show "what each run cost". No additional model calls: the value is
re-threaded from a field that is currently dropped on the floor.

## Cost source (no extra calls)

`reviewPullRequest` (reviewer-core) already returns `outcome.costUsd`. Priority,
per provider, is already wired in the LLM layer:

1. **OpenRouter** — real billed USD from the response `usage.cost` (we request
   `usage: { include: true }`). Falls back to `PriceBook.estimate()` (live
   OpenRouter `/models` pricing) when `usage.cost` is absent.
2. **OpenAI / Anthropic adapters** — static `pricing.ts` estimate
   (`tokens x per-1M price`); `null` for unknown models.

The "matches the OpenRouter dashboard" guarantee therefore holds for OpenRouter
runs (the studio default); other providers are best-effort estimates.

## Persistence

`agent_runs.cost_usd` (`double precision`, **nullable**) — re-added (it existed
pre-migration `0009`). Set only when a run **completes successfully**:

- success → `cost_usd = outcome.costUsd` (may itself be `null` if the provider
  returned no cost and no estimate was possible).
- failure / cancel / still-running → `cost_usd` stays `null`. Never write `0` as
  a stand-in for "unknown".

The same value is mirrored into the single `run_traces.trace.stats.cost_usd`
document at completion.

## Contract additions (`@devdigest/shared`, vendored)

Edit the canonical server copy under `server/src/vendor/shared/`, then mirror by
hand into `client/src/vendor/shared/` (no auto-sync).

- `contracts/trace.ts`
  - `RunSummary` += `cost_usd: z.number().nullable()`
  - `RunStats` += `cost_usd: z.number().nullable()`
- `contracts/platform.ts`
  - `PrMeta` += `cost_usd: z.number().nullish()` (`PrDetail` inherits via
    `.extend`).

`null` is the wire signal for "no cost data" → the client renders `—`.

## GET routes

- `GET /pulls/:id/runs` (`RunSummary[]`) and `GET /runs/:id/trace` (`RunTrace`)
  pick up the new fields automatically once the repository mapper + trace stats
  carry them.
- `GET /repos/:id/pulls` (`PrMeta[]`) — `cost_usd` is the **sum of all completed
  runs'** cost for that PR. Computed on read: one `IN` query over `agent_runs`
  filtered to `status = 'done'`, then a JS sum of each row's `cost_usd` per
  `pr_id` (rows with a null/non-finite `cost_usd` are skipped). It is a read-time
  aggregate, so deleting a run subtracts its cost on the next fetch — no stored
  total. PRs with no completed run that has a known cost → `cost_usd: null`.

## Out of scope

- `reviewer-core` (already computes `costUsd`).
- `multi_agent_runs`, `ci_runs`, `eval_runs` cost aggregates; agent-performance
  dashboard.
- Backfilling cost for runs that predate the column — they correctly show `—`.
