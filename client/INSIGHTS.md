# client — insights

Durable, non-obvious learnings for this module. Append-only, newest on top within each section.
Skip anything obvious from reading the code. Written by the `engineering-insights` skill.
Entry format: `- YYYY-MM-DD — <fact> / why it matters / how to apply (file:line)`

## What Works
<!-- approaches & solutions that worked -->

## What Doesn't Work
<!-- dead ends & antipatterns to avoid (highest-value section — don't skip it) -->

## Codebase Patterns
<!-- conventions & architectural choices specific to this module -->
- 2026-06-21 — The PR-list table column set is driven by `COLUMN_KEYS` + the `GRID` template string, which must stay in lock-step with the cell order in `PRRow`. Adding a column = update all three (constants + a `list.columns.*` i18n key + the `<div>` cell). Header maps `COLUMN_KEYS` → `t('list.columns.<key>')` (client/src/app/repos/[repoId]/pulls/constants.ts:27).
- 2026-06-21 — `ReviewRecord` carries no token/cost; the run that produced it does. To show run cost on the verdict row, the page joins `prRuns` (`RunSummary[]`) by `review.run_id` in `FindingsTab` and threads cost/tokens down through `ReviewRunAccordion` → `VerdictBanner` (client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsTab/FindingsTab.tsx).
- 2026-06-21 — Run cost is rendered ONLY via `RunCostBadge` (formatters in `lib/format-cost.ts`): null/unknown/non-`done` → "—", never "$0.00"; cost uses ≥3 meaningful digits. Reuse it rather than formatting `$` inline (client/src/components/RunCostBadge/RunCostBadge.tsx).

## Tool & Library Notes
<!-- dependency quirks, version gotchas, flags -->

## Decisions
<!-- decisions with the reason behind them -->

## Recurring Errors & Fixes
<!-- errors that keep coming back + the fix -->

## Session Notes
<!-- dated session summaries -->

## Open Questions
<!-- still unresolved -->
