# Run Cost Badge — client spec

Show cost + tokens for each completed run via one reusable `RunCostBadge`
component, in four places. Data comes from the server contracts (`PrMeta`,
`RunSummary`, `RunStats`) — the client never recomputes cost.

## Component: `RunCostBadge`

`client/src/components/RunCostBadge/`. Built on the `Badge` primitive.

Props:

```ts
{
  costUsd: number | null | undefined;
  tokensIn?: number | null;
  tokensOut?: number | null;
  variant: "compact" | "detailed";
  /** Run lifecycle status; anything other than "done" renders the empty state. */
  status?: string | null;
}
```

- `compact` → cost only, e.g. `$0.012`.
- `detailed` → cost + token flow, e.g. `$0.014 · 8.2K→1.3K`.

### Empty state (critical)

Render `—` (never `$0.00`) when **any** of:

- `costUsd` is `null` / `undefined` / not finite, OR
- `status` is provided and is not `"done"` (running / failed / cancelled / stale).

A genuine free-model run (real `0`) is the only case that may render `$0.000`;
unknown cost is always `—`.

## Formatting (`client/src/lib/format-cost.ts`)

- `formatUsd(cost): string`
  - `null` / `undefined` / non-finite → `—`.
  - At least **3 meaningful digits** — never collapse a non-zero cost to
    `$0.01` or `$0.00`. Examples: `0.0134 → $0.0134`, `0.012 → $0.012`,
    `0.0013 → $0.0013`, `0.00012 → $0.000120`, `1.2345 → $1.23`.
  - Rule: `>= 1` → 2 decimals; otherwise enough decimal places to show ≥3
    significant figures (min 3 decimals), extending precision for sub-`$0.001`.
- `formatTokenFlow(inTok, outTok): string`
  - `8200, 1300 → "8.2K→1.3K"` (uppercase K, 1 decimal at/above 1000; raw
    below 1000). `null` inputs treated as `0`.

## Placements

1. **PR list COST column** (`compact`) — [pulls/page.tsx](../src/app/repos/[repoId]/pulls/page.tsx)
   header + [PRRow.tsx](../src/app/repos/[repoId]/pulls/_components/PRRow/PRRow.tsx)
   cell. Source: `PrMeta.cost_usd` (sum of all completed runs for the PR). Add
   `"cost"` to `COLUMN_KEYS`, widen `GRID`, add `list.columns.cost` i18n key.
2. **PR Detail verdict row** (`detailed`) — in
   [VerdictBanner.tsx](../src/app/repos/[repoId]/pulls/[number]/_components/VerdictBanner/VerdictBanner.tsx)
   `titleRow`. The page joins `prRuns` (`RunSummary[]`) by `review.run_id` and
   passes `costUsd` / `tokensIn` / `tokensOut` through `ReviewRunAccordion`.
3. **Agent-runs timeline** (`detailed`) — per settled run in
   [RunHistory.tsx](../src/app/repos/[repoId]/pulls/[number]/_components/RunHistory/RunHistory.tsx)
   from `RunSummary.cost_usd` + tokens.
4. **Run-trace drawer** — a fourth COST `Stat` in
   [TraceBody.tsx](../src/app/repos/[repoId]/pulls/[number]/_components/RunTraceDrawer/_components/TraceBody/TraceBody.tsx)
   from `RunStats.cost_usd` (uses `formatUsd`). Add `trace.stat.cost` i18n key.

## Out of scope

Multi-agent review page, agent-performance dashboard, CI/eval cost surfaces.
