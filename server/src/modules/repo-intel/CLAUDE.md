<!-- Map for the repo-intel module. Root + server CLAUDE.md have wider facts —
     don't repeat them. Link with plain markdown (lazy), never @import. -->

# repo-intel — the codebase indexer

In-process module (not a service). Indexes a cloned repo ONCE on clone, then
incrementally on fetch (keyed by file content hash) → symbols, import graph,
PageRank file importance, and a cached **repo map**. Powers the **Indexed** badge
and feeds project context into reviews. Pipeline + facade detail → [README.md](README.md).

## Conventions (non-default — easy to break)
- **Read-only at review time**: the index is precomputed; a review only reads it,
  it never indexes. Keep analysis out of the request path.
- Everything downstream goes through the **facade** (`service.ts`, `repoIntel.*`) —
  never reach into `pipeline/*` internals from other modules.
- **Degrade gracefully**: an unindexed/partial repo returns empty results, never throws.
- Starter wires only `getRepoMap` / `getFileRank` / `getCallerSignatures`
  (into `../reviews/run-executor.ts`). Other facade methods exist for later lessons — don't assume they're live.
- Gated by `REPO_INTEL_ENABLED` (global) + per-agent `repo_intel` flag.

## Pipeline
`pipeline/{full,incremental}.ts` → `walk → ast-grep → import graph → rank → repo-map`,
persisted to Postgres (symbols · references · file_edges · file_rank · repo_map_cache).

## More
[docs/](docs/) · [specs/](specs/) · [INSIGHTS.md](INSIGHTS.md)
