<!-- Map for reviewer-core/. Root CLAUDE.md has repo-wide facts — don't repeat them.
     Link with plain markdown (lazy), never @import. Keep it short. -->

# reviewer-core/ — `@devdigest/reviewer-core`

The pure review engine: `diff + agent inputs + injected LLM → grounded Review`.
Pipeline detail → [README.md](README.md).

## Commands
`pnpm typecheck` · `test` · `build` (build = typecheck only — see below).

## Conventions (non-default — easy to break)
- **NO I/O**: no DB, GitHub, fs. The only side effect is the INJECTED `LLMProvider`.
  Keep it that way — callers (server / CI runner) do all persistence and fetching.
- Inputs are RESOLVED strings (skill bodies, memory, specs), never slugs/ids.
- Emits NO JS: consumed as TypeScript source via tsconfig path alias (tsx / vitest / ncc).
  Its `build` is a type-check, not a bundle.
- Entry point: `reviewPullRequest` in `src/review/run.ts`. The grounding gate
  (`src/grounding.ts`) mechanically drops findings that don't cite the diff — keep it mandatory.

## More
[docs/](docs/) · [specs/](specs/) · [INSIGHTS.md](INSIGHTS.md)
