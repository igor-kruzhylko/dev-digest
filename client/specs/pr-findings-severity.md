# PR Findings by Severity — client spec

Surface review findings by severity across the PR surfaces: per-severity counters
with icons, hover/click popovers listing the actual findings, and a PR-wide
severity filter on the detail page. Severity literals come from the shared
contract (`CRITICAL | WARNING | SUGGESTION`); colour/icon/label come from the
`SEV` token map (`@devdigest/ui`) — never hardcoded. The client never recomputes
finding data; it reads `PrMeta.findings` (list) and `ReviewRecord.findings`
(detail).

## Components

### `HoverCard` — `client/src/components/HoverCard/`
Generic hover/focus-triggered popover. **Portalled to `document.body`** via the
shared `OverlayPortal` (`src/vendor/ui/kit/OverlayPortal`) so table rows /
accordions with `overflow` clipping cannot cut it off, and it is positioned
against its trigger with viewport clamping.

```ts
{
  children: React.ReactNode;        // always-visible trigger
  content: React.ReactNode;         // panel body; null/undefined → no popover
  align?: "left" | "right";         // default "left"
  width?: number;                   // default 380
  open?: boolean;                   // controlled; omit for uncontrolled hover
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
}
```

- Opens on `mouseenter`/`focus`; closes on `mouseleave`/`blur` after a short
  delay (~110 ms) so the pointer can travel trigger → panel without flicker.
- `stopPropagation` on click — triggers usually sit inside a clickable row.
- Controlled mode (`open` + `onOpenChange`) lets a parent pin it open (used for
  click-to-filter); uncontrolled mode is plain hover.

### `FindingsHint` — `client/src/components/FindingsHint/`
Three exports:

- **`SeverityCounts`** — inline per-severity icon + count, worst-first
  (CRITICAL → WARNING → SUGGESTION), only severities with count > 0. Empty
  findings → `—` (muted). Two modes:
  - *display* (no `onSeverityClick`): non-interactive `<span>`s, each
    `title="{n} {severity}"` (e.g. `2 critical`).
  - *interactive* (`onSeverityClick` given): `<button>`s with `aria-pressed`,
    an active outline on `activeSeverity`, same `title`.
- **`FindingsHintContent`** — popover body: a `"{n} findings"` header + a
  `· `-joined severity summary, then a scrollable, worst-first list of finding
  rows (`SeverityBadge` compact, title, `CategoryTag`, `file:line` `MonoLink`
  deep-linking GitHub when `repoFullName` + `headSha` are known, `ConfidenceNum`,
  and a 2-line-clamped rationale). Renders `null` for an empty list.
- **`FindingsHint`** — the composed cell: `SeverityCounts` (interactive) inside a
  controlled `HoverCard`.
  - Hovering the cell opens the popover with **all** findings.
  - Clicking a severity icon sets a local `severityFilter` (toggle) **and** opens
    the popover **filtered to that severity**; the clicked icon shows active.
  - Closing the popover resets the filter (`onClose`).
  - Empty findings → bare `SeverityCounts` (`—`), no popover.

### `SeverityFilterBar` — `…/pulls/[number]/_components/SeverityFilterBar/`
PR-wide filter for the detail page's "Review runs". Renders an **All** chip plus
one `Chip` per present severity (worst-first via `SEVERITY_ORDER`) with `SEV`
colour/icon and the count. Clicking a severity selects it; clicking the active
one or **All** clears. Counts aggregate across all runs and ignore each panel's
hide-low-confidence toggle.

## Placements

1. **PR list — FINDINGS column** ([PRRow.tsx](../src/app/repos/[repoId]/pulls/_components/PRRow/PRRow.tsx)).
   `"findings"` sits between `"score"` and `"status"` in `COLUMN_KEYS`; `GRID`
   widened; `list.columns.findings` i18n key added. Cell = `<FindingsHint
   findings={pr.findings ?? []} repoFullName={activeRepo?.full_name} headSha=
   {pr.head_sha} />`. Source: `PrMeta.findings`.

2. **PR detail — timeline** ([RunHistory.tsx](../src/app/repos/[repoId]/pulls/[number]/_components/RunHistory/RunHistory.tsx)).
   The per-run status `Badge` (outcome: running / error / cancelled / rejected /
   reviewed / approved) stays as-is. Below the agent name, settled runs render
   `<FindingsHint>` with that run's findings — same counters + click-to-filter
   popover. Findings are joined to runs by `run_id`: `FindingsTab` builds
   `findingsByRunId` from `ReviewRecord.findings` and passes it down with
   `repoFullName` / `headSha`.

3. **PR detail — "Review runs" filter** ([FindingsTab.tsx](../src/app/repos/[repoId]/pulls/[number]/_components/FindingsTab/FindingsTab.tsx)).
   `SeverityFilterBar` renders above the run accordions when any findings exist.
   The selected `sevFilter` (a) hides accordions whose review has no finding of
   that severity (`visibleRuns`), and (b) threads through `ReviewRunAccordion` →
   `FindingsPanel`. `visibleFindings(findings, hideLow, severityFilter?)` is the
   single chokepoint that applies it alongside the confidence toggle and the
   severity sort.

## Behaviour notes

- Worst-first ordering everywhere uses `SEVERITY_ORDER`
  (`FindingsPanel/constants.ts`): CRITICAL=0, WARNING=1, SUGGESTION=2.
- `FindingsPanel` resets `focusIdx` when its visible list shrinks (filter/hideLow
  can drop it below the current index).
- The **Run Trace drawer no longer has a Findings section** — it was redundant
  with the timeline popover + the review accordion, so `TraceBody` / `RunTraceDrawer`
  dropped it (the `findings` prop is kept only for caller compatibility).

## i18n (`messages/en/prReview.json`)

- `list.columns.findings` = `"Findings"`.
- `severityFilter.all` = `"All"` (severity chip labels reuse `SEV[sev].label`).

## Tests

- `FindingsHint.test.tsx` — `SeverityCounts` counts + `—`; `FindingsHintContent`
  lists all with header; `FindingsHint` click-a-severity → popover (`role=
  "tooltip"`) filtered to that severity only.
- `HoverCard.test.tsx` — open/close behaviour.
- `FindingsPanel/helpers.test.ts` — `visibleFindings` severity filter (no-op when
  null, narrows to one, combines with hideLow, empty when none match).
- `RunHistory.test.tsx` — timeline renders the per-run findings hint.

## Out of scope

Multi-agent review page, agent-performance dashboard, CI/eval finding surfaces,
URL-syncing the filters (ephemeral local state, like the `hideLow` toggle).
