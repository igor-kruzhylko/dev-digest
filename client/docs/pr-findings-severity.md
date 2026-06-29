# Findings by Severity — product requirements

Business- and user-level requirements for how review findings are surfaced by
severity across the Pull Requests experience. Implementation lives in the specs
(`client/specs/pr-findings-severity.md`, `server/specs/pr-findings-severity.md`).

## Background & problem

A reviewer skim through a list of PRs, or down one PR's run history, couldn't
tell at a glance *how bad* a PR was — only that it had "some" findings or a
score. To judge risk they had to open each PR and read every run. We want the
severity picture — how many criticals, warnings, suggestions — visible up front,
and one click away from the actual findings behind those numbers.

Findings have three severities, most-to-least serious: **Critical**, **Warning**,
**Suggestion**. Each has a consistent colour and icon used everywhere they appear.

## Goals

- Show, at a glance, how many findings of each severity a PR has — on the list
  and per review run.
- Let a reviewer drill from a count straight to the findings behind it, without
  leaving the page.
- Let a reviewer focus on one severity at a time when triaging a PR.
- Keep these numbers honest — they update as reviews run and as findings are
  resolved or runs are deleted.

## User stories

1. **As a reviewer scanning the PR list**, I see a *Findings* column with a
   per-severity count (e.g. "2 critical · 2 warning · 2 suggestion") for each PR,
   so I can spot the risky ones without opening them.
2. **As a reviewer**, I can hover a PR's finding counts to preview the actual
   findings (title, file & line, confidence, short rationale) in a popover, and
   click a specific severity to narrow that preview to just that severity.
3. **As a reviewer on a PR's detail page**, each agent run in the timeline shows
   its outcome (approved / changes requested / errored …) and its own
   per-severity finding counts, with the same hover-to-preview behaviour.
4. **As a reviewer triaging one PR**, I can pick a severity at the top of the
   review results to show only findings of that level across all runs, and clear
   it to see everything again.
5. **As a reviewer**, the counts I see always reflect the current state — they
   refresh after a new review runs, after I accept/dismiss a finding, and after I
   delete a run.

## Functional requirements (user-observable)

- **Counts**: each severity shows its icon + number; severities with zero
  findings are not shown. A PR (or run) with no findings shows a dash ("—"), not
  zeros.
- **Ordering**: findings and counts are always ordered worst-first — Critical,
  then Warning, then Suggestion.
- **Preview popover**: lists findings with title, file:line (a link to the code
  on GitHub when available), confidence, and a short (clamped) rationale. It is
  scrollable when long and never gets clipped by the surrounding layout.
- **Severity focus**:
  - On the list, clicking a severity narrows that PR's preview to that severity.
  - On a PR's detail page, choosing a severity shows only those findings across
    all runs and hides runs that have none of it; "All" (or re-clicking the
    chosen severity) restores everything. The focus is a temporary view — it
    resets when navigating away.
- **Freshness**: counts and previews update automatically after a review
  completes, after accept/dismiss, and after deleting a run (deleting a run
  removes its findings from the totals).

## Acceptance criteria

- The PR list has a Findings column between Score and Status; an unreviewed PR
  shows "—".
- For a PR with 2 critical, 2 warning, 2 suggestion findings, the list cell reads
  those three counts; hovering reveals all six; clicking "critical" shows only
  the two critical ones.
- On the detail page, each timeline run shows its status and its own counts;
  hovering a run reveals that run's findings.
- Selecting "Warning" in the review results shows only warning findings and hides
  runs with no warnings; clearing it restores all.
- Running a new review, dismissing a finding, or deleting a run updates the list
  counts without a manual page refresh.

## Non-goals

- Severity surfaces on the multi-agent review page, agent-performance dashboard,
  or CI/eval screens.
- Bookmarkable/shareable filtered URLs (the severity focus is an in-session view).
- Changing how severity is assigned — it is set by the reviewer agents at review
  time and is not editable in the UI.
