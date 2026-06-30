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

## What to capture
Eight categories — each maps 1:1 to a `##` section in `INSIGHTS.md`. Don't infer them from the file; use this list.
- **What Works** — an approach/solution that worked and is worth reusing.
- **What Doesn't Work** — a dead end or antipattern to avoid (highest-value; don't skip it).
- **Codebase Patterns** — a convention or architectural choice specific to this module.
- **Tool & Library Notes** — a dependency quirk, version gotcha, or required flag.
- **Decisions** — a choice made *with the reason behind it* (X over Y because Z).
- **Recurring Errors & Fixes** — an error that keeps coming back, plus the fix.
- **Session Notes** — a dated summary of what a session changed/discovered.
- **Open Questions** — something still unresolved, worth revisiting.

## Where
Write to the `INSIGHTS.md` of the module whose files the task touched — `server/`, `client/`,
`reviewer-core/`, `e2e/`. There are exactly these four; changes anywhere under `server/`. Touched several
modules → one entry in each, in its own file.

## How
- **Read the target `INSIGHTS.md` first**, before writing anything. Then decide:
  - Already covered by an existing entry → don't append (no duplicates).
  - Contradicts an existing entry → append a new dated note that supersedes it (don't edit the old one).
  - Genuinely new → append it.
- **Append-only, newest on top** inside the matching `##` section. Never overwrite an existing entry.
- File it under the matching category above (one `##` section each).
- Entry format: `- YYYY-MM-DD — <fact> / why it matters / how to apply (file:line)`.
- Be specific and actionable read cold months later, not vague.
  - Bad: `async can be tricky`.
  - Good: `Promise.all on ingest times out past 30 items — use allSettled in batches of 10 (server/src/modules/repos/ingest.ts:42)`.
