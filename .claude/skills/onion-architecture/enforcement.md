# Enforcement — the dependency rule fails the build

A skill *guides*; it can't *force*. The force comes from `dependency-cruiser`
(already in `server/`'s dependencies). The rule set is **landed and green** —
each ring crossing is now a build error, not a matter of memory or review.

> Status: **LANDED + GREEN.** `pnpm arch` passes in `server/` (0 errors) and the
> purity gate passes in `reviewer-core/`. Canonical configs live in the repo —
> do not duplicate them here (this skill preaches against vendored drift):
> - [server/.dependency-cruiser.cjs](../../../server/.dependency-cruiser.cjs)
> - [reviewer-core/.dependency-cruiser.cjs](../../../reviewer-core/.dependency-cruiser.cjs)

## What the server rules forbid

| Rule | Forbids |
|---|---|
| `service-no-drizzle` | a `service.ts` importing `drizzle-orm`/`postgres`/`src/db` |
| `service-no-fastify` | a `service.ts` importing `fastify`/`@fastify/*` |
| `service-no-sdk` | a `service.ts` importing `octokit`/`simple-git`/`openai`/`@anthropic-ai` |
| `service-no-adapter-concrete` | a `service.ts` importing a concrete `src/adapters/*` |
| `routes-no-sql` | a `routes.ts` importing `drizzle-orm`/`postgres`/`src/db` |
| `drizzle-only-in-repository` | Drizzle imported anywhere under `src/modules` except a `repository.ts` / `repository/` |
| `no-cross-module-repository` | a module importing a sibling module's `repository` |
| `no-circular` | dependency cycles (see exception below) |
| `no-orphans` (warn) | dead modules nothing imports |

`reviewer-core` adds `core-stays-pure`: no `fastify`/`drizzle`/`postgres`/
`octokit`/`simple-git` and no `node:fs|net|http|https|child_process` — the engine
talks only through the injected `LLMProvider`.

## Documented exceptions (narrow, by design — never widen casually)

Three carve-outs encode legitimate, intentional design — each as a tight
`pathNot`/`viaNot`, not a deleted rule:

1. **`db/rows.ts` is allowed inward.** `service-no-drizzle` excludes
   `src/db/rows.ts` — it holds shared, inferred ROW TYPES (no SQL), deliberately
   placed next to the schema so cross-cutting consumers reference a row shape
   without importing another module's data layer.
2. **repo-intel may touch index adapters.** `service-no-adapter-concrete`
   excludes `src/modules/repo-intel/service.ts` — repo-intel is the documented
   in-process indexer (`src/modules/repo-intel/CLAUDE.md`) that orchestrates
   low-level index adapters directly.
3. **Composition-root cycles are allowed.** `no-circular` uses
   `viaNot: container.ts` — the root legitimately constructs the facades (e.g.
   repo-intel) that reference it back. Genuine module-internal cycles still fail.

## Run it

```jsonc
// server/package.json (added)
"scripts": { "arch": "depcruise src --config .dependency-cruiser.cjs" }
```

- `pnpm arch` (in `server/`) — fails on any violation (exit ≠ 0). This is the gate.
- `reviewer-core/` has no `depcruise` dependency yet; it was validated by running
  `server/`'s binary against it. To make it a first-class `pnpm arch` there, add
  `dependency-cruiser` to `reviewer-core/`'s devDependencies and the same script.

## Wire into CI

Run `arch` alongside `typecheck` in the server (and reviewer-core) jobs so a
layering violation blocks the merge, not just a reviewer's attention. See
[TESTING.md](../../../TESTING.md) for the CI matrix.

## How the green baseline was reached

The first run was red: 4 "thin" modules (`polling`, `pulls`, `settings`,
`workspace`) queried the DB straight from their routes, and a couple of import
cycles existed. Rather than weaken the rules, those modules were refactored to
the standard `routes → service → repository` triple — PR-import persistence moved
behind `container.pullsRepo`, repo reads behind `container.repoRepo`, settings
behind a `SettingsRepository`, and the PR-list score/cost aggregates onto
`ReviewRepository`. The agents `helpers ↔ repository` cycle was broken by sourcing
row types from `db/rows.ts`. Typecheck and the DB-backed test suite stayed green
throughout.
