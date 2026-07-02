<!-- MAP, not docs. Loaded every session — keep ≤100 lines.
     Line-test before adding anything: "remove this line → will Claude start
     making mistakes?" No → don't add it. Facts live in ONE file; others link.
     Link with plain markdown (lazy/conditional) — never @import (eager). -->

# DevDigest — repo map

Local-first AI pull-request review. Full intro → [README.md](README.md).
**Not a monorepo workspace**: each package has its own `package.json` + lockfile;
cross-package code is shared via tsconfig path aliases, not published modules.

## Stack
Node ≥22 · pnpm ≥10 · Fastify · Next.js 15 (App Router) · Drizzle + Postgres/pgvector
· Zod (contracts) · Vitest · Docker (Postgres only).

## Packages — detail lives in each package's CLAUDE.md (link, don't rely on auto-load)
- [server/](server/CLAUDE.md) — `@devdigest/api` · Fastify + DB + repo-intel · :3001
- [client/](client/CLAUDE.md) — `@devdigest/web` · Next.js studio · :3000
- [reviewer-core/](reviewer-core/CLAUDE.md) — `@devdigest/reviewer-core` · pure review engine, no I/O
- [e2e/](e2e/CLAUDE.md) — `@devdigest/e2e` · deterministic browser e2e

## Shared contracts (`@devdigest/shared`)
Single source of truth for cross-package Zod contracts. **Vendored per package**
(`server/src/vendor/shared`, `client/src/vendor/shared`) — no automated sync script,
so a change must be applied to every copy by hand. Edit contracts here, not at call sites.

## Run / test
`./scripts/dev.sh` (Postgres + API + web from zero). Full test strategy → [TESTING.md](TESTING.md).

## Gotchas (what you can't infer from the code)
- Migrations do NOT run on boot: `cd server && pnpm db:migrate` (else `relation ... does not exist`).
- Boot reaper assumes a SINGLE API instance per DB (breaks with replicas).
- On this Windows box, if `apply_patch` gets `Access is denied`, use PowerShell exact replacements: `Get-Content -Raw -LiteralPath ...` then `Set-Content -Encoding utf8`.

## Do-not-touch
- `server/clones/**` — cloned THIRD-PARTY repos (the app's input data). Never edit, never index/search.
- `**/src/vendor/**` — vendored copies; change the canonical contract, then re-sync.

## Docs convention (applies to every package)
- `README.md` — overview · `docs/` — human prose / architecture · `specs/` — formal specs / e2e flows · `INSIGHTS.md` — gotchas & decisions log.

## Read when (instruction, not a footnote — follow the link when the trigger matches)
- writing/editing reviewer agent prompts → [docs/agent-prompts/](docs/agent-prompts/)
- setting up or debugging tests/CI → [TESTING.md](TESTING.md)
- hit something non-obvious, or wrapping up a non-trivial task → run `/engineering-insights` to append the learning to the touched module's `INSIGHTS.md`. Do not skip the wrap-up.
