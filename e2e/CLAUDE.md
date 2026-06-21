<!-- Map for e2e/. Root CLAUDE.md has repo-wide facts — don't repeat them.
     Link with plain markdown (lazy), never @import. Keep it short. -->

# e2e/ — `@devdigest/e2e`

Deterministic browser e2e (agent-browser) against the real stack. NO LLM in flows.
Overview → [README.md](README.md).

## Commands
`pnpm test` · `e2e:hermetic` · `typecheck`. From repo root: `./scripts/e2e.sh`.

## Conventions
- Flows are JSON specs in [specs/](specs/) (`NN-name.flow.json`), run in order.
- Deterministic by design — no real LLM calls; needs Postgres + API + web up.

## More
[docs/](docs/) · [INSIGHTS.md](INSIGHTS.md)
