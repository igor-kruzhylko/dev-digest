---
name: engineering-insights
description: Captures durable engineering insights — gotchas, decisions, codebase patterns, recurring fixes — into the touched module's INSIGHTS.md. Use at task wrap-up, and mid-task the moment something non-obvious surfaces (a surprising bug, a fix, an architectural decision, a tooling quirk). Triggers on "/engineering-insights", "wrap up", "capture learnings", or after finishing a non-trivial change.
---

# Engineering Insights

Append durable, non-obvious learnings to the right module's `INSIGHTS.md`.

## When
- **Wrap-up**: at the end of any task >30 min that hit a problem, a decision, or a discovery.
- **As you go**: the moment something non-obvious surfaces — capture it, don't wait for the end.
- **Skip trivia**: if it's obvious to anyone reading the code, don't write it.

## Where
Write to the `INSIGHTS.md` of the module whose files the task touched — `server/`, `client/`,
`reviewer-core/`, `e2e/`. There are exactly these four; changes anywhere under `server/`
(including `server/src/modules/repo-intel/`) go to `server/INSIGHTS.md`. Touched several
modules → one entry in each, in its own file.

## How
- **Append-only, newest on top** inside the matching `##` section. Never overwrite an existing
  entry; correct a stale one by appending a new dated note that supersedes it.
- Pick the section: What Works · What Doesn't Work · Codebase Patterns · Tool & Library Notes ·
  Decisions · Recurring Errors & Fixes · Session Notes · Open Questions.
- Entry format: `- YYYY-MM-DD — <fact> / why it matters / how to apply (file:line)`.
- Be specific and actionable read cold months later, not vague.
  - Bad: `async can be tricky`.
  - Good: `Promise.all on ingest times out past 30 items — use allSettled in batches of 10 (server/src/modules/repos/ingest.ts:42)`.
