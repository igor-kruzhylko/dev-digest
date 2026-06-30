# client — insights

Durable, non-obvious learnings for this module. Append-only, newest on top within each section.
Skip anything obvious from reading the code. Written by the `engineering-insights` skill.
Entry format: `- YYYY-MM-DD — <fact> / why it matters / how to apply (file:line)`

## What Works
<!-- approaches & solutions that worked -->
- 2026-06-29 — Anchored floating panels (hover popovers, dropdowns) go through the shared `OverlayPortal` (`src/vendor/ui/kit/OverlayPortal`): it portals to `document.body`, positions against an `anchorRef` with viewport clamping, and takes `align`/`width`/`offset`. `HoverCard` builds on it (controlled `open`/`onOpenChange`/`onClose` + ~110 ms close delay so the pointer can cross trigger→panel). Reuse it for any anchored overlay — do NOT hand-roll absolute positioning (clips) or duplicate the math (`Dropdown` was refactored onto it too) (client/src/components/HoverCard/HoverCard.tsx, client/src/vendor/ui/kit/OverlayPortal.tsx).
- 2026-06-29 — [SUPERSEDED by the OverlayPortal note above] Flicker-free hover popover without a portal: make the panel a DOM child of the trigger wrapper and keep it flush (top:100%, NO margin gap). React `onMouseEnter`/`onMouseLeave` ignore moves between an element and its descendants, so the pointer can travel from trigger into the panel without firing leave — but a margin gap is non-descendant space and reopens the flicker. Also `stopPropagation` clicks since triggers often sit inside a clickable row (client/src/components/HoverCard/HoverCard.tsx).

## What Doesn't Work
<!-- dead ends & antipatterns to avoid (highest-value section — don't skip it) -->
- 2026-06-29 — A popover rendered as a DOM child of its trigger (absolute, `top:100%`) gets CLIPPED when any ancestor sets `overflow:hidden` — e.g. `ReviewRunAccordion`'s card wrapper and the PR-list rows. It looked fine in isolation but was cut off in place. Fix: portal the panel to `document.body` and position it against the trigger (use `OverlayPortal`). This supersedes the earlier same-day "no-portal" approach (client/src/components/HoverCard/HoverCard.tsx).

## Codebase Patterns
<!-- conventions & architectural choices specific to this module -->
- 2026-06-30 — Client hooks should type request/response payloads from @devdigest/shared, not local interfaces: agents/reviews/repo-intel now import CreateAgentInput/UpdateAgentInput/PrCommentInput/RunRequest/RepoIntelState so browser code cannot drift from Fastify route contracts (client/src/lib/hooks/agents.ts:8, client/src/lib/hooks/reviews.ts:12).
- 2026-06-29 — Per-severity finding counts + drill-in popover are one shared `FindingsHint` (`src/components/FindingsHint`), used by BOTH the PR-list FINDINGS column and the PR-detail timeline rows. `SeverityCounts` has two modes — display (plain spans) and interactive (buttons, when given `onSeverityClick`); `FindingsHintContent` is the popover body. Hovering shows all findings; clicking a severity pins the popover filtered to just that severity (controlled `HoverCard.open`). Don't fork a second counts/popover component — extend this one (client/src/components/FindingsHint/FindingsHint.tsx).
- 2026-06-29 — `visibleFindings(findings, hideLow, severityFilter?)` is the SINGLE chokepoint for per-panel finding filtering — both the "hide low confidence" toggle and the PR-wide severity filter funnel through it before the severity sort. Add any new finding filter here, not inline in `FindingsPanel`, so all run panels stay consistent (client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/helpers.ts:5).
- 2026-06-29 — PR-wide severity counter/filter: state (`sevFilter`) lives in `FindingsTab`, counts aggregate `runs.flatMap(r => r.findings)`, and the selected severity is threaded down `ReviewRunAccordion` → `FindingsPanel` (same threading style as cost/tokens). `FindingsTab` also hides accordions with no matching-severity finding, and the accordion force-opens when a filter is active so hits are visible. Severity chip color/icon/label MUST come from the shared `SEV` token map, never hardcoded (client/src/app/repos/[repoId]/pulls/[number]/_components/SeverityFilterBar/SeverityFilterBar.tsx).
- 2026-06-21 — The PR-list table column set is driven by `COLUMN_KEYS` + the `GRID` template string, which must stay in lock-step with the cell order in `PRRow`. Adding a column = update all three (constants + a `list.columns.*` i18n key + the `<div>` cell). Header maps `COLUMN_KEYS` → `t('list.columns.<key>')` (client/src/app/repos/[repoId]/pulls/constants.ts:27).
- 2026-06-21 — `ReviewRecord` carries no token/cost; the run that produced it does. To show run cost on the verdict row, the page joins `prRuns` (`RunSummary[]`) by `review.run_id` in `FindingsTab` and threads cost/tokens down through `ReviewRunAccordion` → `VerdictBanner` (client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsTab/FindingsTab.tsx).
- 2026-06-21 — Run cost is rendered ONLY via `RunCostBadge` (formatters in `lib/format-cost.ts`): null/unknown/non-`done` → "—", never "$0.00"; cost uses ≥3 meaningful digits. Reuse it rather than formatting `$` inline (client/src/components/RunCostBadge/RunCostBadge.tsx).

## Tool & Library Notes
<!-- dependency quirks, version gotchas, flags -->
- 2026-06-30 — Typecheck is not enough after vendored shared contract edits: unused DTO drift in client/src/vendor/shared/contracts/knowledge.ts compiled cleanly. Run git diff --no-index -- server/src/vendor/shared/contracts/<file> client/src/vendor/shared/contracts/<file> for every touched shared contract before wrap-up (client/src/vendor/shared/contracts/knowledge.ts:207).

## Decisions
<!-- decisions with the reason behind them -->
- 2026-06-29 — The Run Trace drawer's Findings section was REMOVED (`TraceBody` no longer renders `FindingsSection`; `RunTraceDrawer`/`TraceBody` keep the `findings` prop only for caller compatibility). Findings now surface via the timeline per-run hover popover + the review accordion, so the trace section was redundant. Don't re-add it (client/src/app/repos/[repoId]/pulls/[number]/_components/RunTraceDrawer/_components/TraceBody/TraceBody.tsx).
- 2026-06-29 — Severity filter on the PR detail page is ephemeral local `useState` in `FindingsTab`, NOT URL-synced, chosen to mirror the existing per-panel `hideLow` toggle (resets on navigation). URL-sync (`?sev=`) was deliberately deferred — only add it if shareable/deep-linkable filtered views are needed (client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsTab/FindingsTab.tsx).

## Recurring Errors & Fixes
<!-- errors that keep coming back + the fix -->

## Session Notes
<!-- dated session summaries -->

## Open Questions
<!-- still unresolved -->
