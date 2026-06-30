# reviewer-core — insights

Durable, non-obvious learnings for this module. Append-only, newest on top within each section.
Skip anything obvious from reading the code. Written by the `engineering-insights` skill.
Entry format: `- YYYY-MM-DD — <fact> / why it matters / how to apply (file:line)`

## What Works
<!-- approaches & solutions that worked -->

## What Doesn't Work
<!-- dead ends & antipatterns to avoid (highest-value section — don't skip it) -->

## Codebase Patterns
<!-- conventions & architectural choices specific to this module -->
- 2026-06-30 — Pure diff parsing belongs in reviewer-core, not the git adapter: parseUnifiedDiff is exported from core so git adapters and persisted-patch fallback share one pure implementation without server adapter coupling (reviewer-core/src/index.ts:26).

## Tool & Library Notes
<!-- dependency quirks, version gotchas, flags -->

## Decisions
<!-- decisions with the reason behind them -->
- 2026-06-30 — OpenRouterProvider is infrastructure and lives in server/src/adapters/llm/openrouter.ts; reviewer-core exposes pure prompt/grounding/diff/structured helpers and accepts an injected LLMProvider. Future provider SDK/fetch code belongs in server adapters, not reviewer-core (reviewer-core/src/llm/openrouter.ts:1).

## Recurring Errors & Fixes
<!-- errors that keep coming back + the fix -->

## Session Notes
<!-- dated session summaries -->

## Open Questions
<!-- still unresolved -->
