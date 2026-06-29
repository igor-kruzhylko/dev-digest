# client — insights

Durable, non-obvious learnings for this module. Append-only, newest on top within each section.
Skip anything obvious from reading the code. Written by the `engineering-insights` skill.
Entry format: `- YYYY-MM-DD — <fact> / why it matters / how to apply (file:line)`

## What Works
<!-- approaches & solutions that worked -->
- 2026-06-29 — Flicker-free hover popover without a portal: make the panel a DOM child of the trigger wrapper and keep it flush (top:100%, NO margin gap). React `onMouseEnter`/`onMouseLeave` ignore moves between an element and its descendants, so the pointer can travel from trigger into the panel without firing leave — but a margin gap is non-descendant space and reopens the flicker. Also `stopPropagation` clicks since triggers often sit inside a clickable row (client/src/components/HoverCard/HoverCard.tsx).

## What Doesn't Work
<!-- dead ends & antipatterns to avoid (highest-value section — don't skip it) -->

## Codebase Patterns
<!-- conventions & architectural choices specific to this module -->
- 2026-06-29 — `visibleFindings(findings, hideLow, severityFilter?)` is the SINGLE chokepoint for per-panel finding filtering — both the "hide low confidence" toggle and the PR-wide severity filter funnel through it before the severity sort. Add any new finding filter here, not inline in `FindingsPanel`, so all run panels stay consistent (client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/helpers.ts:5).
- 2026-06-29 — PR-wide severity counter/filter: state (`sevFilter`) lives in `FindingsTab`, counts aggregate `runs.flatMap(r => r.findings)`, and the selected severity is threaded down `ReviewRunAccordion` → `FindingsPanel` (same threading style as cost/tokens). `FindingsTab` also hides accordions with no matching-severity finding, and the accordion force-opens when a filter is active so hits are visible. Severity chip color/icon/label MUST come from the shared `SEV` token map, never hardcoded (client/src/app/repos/[repoId]/pulls/[number]/_components/SeverityFilterBar/SeverityFilterBar.tsx).
- 2026-06-21 — The PR-list table column set is driven by `COLUMN_KEYS` + the `GRID` template string, which must stay in lock-step with the cell order in `PRRow`. Adding a column = update all three (constants + a `list.columns.*` i18n key + the `<div>` cell). Header maps `COLUMN_KEYS` → `t('list.columns.<key>')` (client/src/app/repos/[repoId]/pulls/constants.ts:27).
- 2026-06-21 — `ReviewRecord` carries no token/cost; the run that produced it does. To show run cost on the verdict row, the page joins `prRuns` (`RunSummary[]`) by `review.run_id` in `FindingsTab` and threads cost/tokens down through `ReviewRunAccordion` → `VerdictBanner` (client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsTab/FindingsTab.tsx).
- 2026-06-21 — Run cost is rendered ONLY via `RunCostBadge` (formatters in `lib/format-cost.ts`): null/unknown/non-`done` → "—", never "$0.00"; cost uses ≥3 meaningful digits. Reuse it rather than formatting `$` inline (client/src/components/RunCostBadge/RunCostBadge.tsx).

## Tool & Library Notes
<!-- dependency quirks, version gotchas, flags -->

## Decisions
<!-- decisions with the reason behind them -->
- 2026-06-29 — Severity filter on the PR detail page is ephemeral local `useState` in `FindingsTab`, NOT URL-synced, chosen to mirror the existing per-panel `hideLow` toggle (resets on navigation). URL-sync (`?sev=`) was deliberately deferred — only add it if shareable/deep-linkable filtered views are needed (client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsTab/FindingsTab.tsx).

## Recurring Errors & Fixes
<!-- errors that keep coming back + the fix -->

## Session Notes
<!-- dated session summaries -->

## Open Questions
<!-- still unresolved -->
