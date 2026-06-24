---
name: onion-architecture
description: "Enforces DevDigest's Onion / Ports-and-Adapters layering for backend code in server/ and reviewer-core/. Use when adding or editing a feature module (the routes.ts → service.ts → repository.ts triple), writing or changing an adapter, defining a shared contract or port interface, wiring the DI container, or deciding WHERE backend code belongs. Covers the dependency rule (all coupling points inward to the core), keeping reviewer-core pure (no I/O), Fastify as transport-only, Drizzle confined to repositories, Zod contracts living in @devdigest/shared, resolving concretes only in the composition root, and mechanical enforcement via dependency-cruiser. Trigger terms: onion architecture, layering, ports and adapters, hexagonal, dependency rule, where should this go, service vs repository, adapter, port, DI container, composition root, clean architecture, decouple, can this import."
metadata:
  tags: architecture, onion, hexagonal, ports-and-adapters, backend, fastify, drizzle, zod, dependency-injection, server
---

# Onion Architecture — DevDigest backend

DevDigest's `server/` and `reviewer-core/` are **already** built as an Onion
(Ports-and-Adapters) system. This skill makes that layering **explicit and
non-negotiable** so it doesn't erode one "quick fix" at a time. It is specific
to *this* repo's folders and tools — not a generic tutorial.

## The one rule

> **All coupling points inward.** An outer ring may depend on an inner ring,
> never the reverse. The core defines interfaces (ports); the edges implement
> them (adapters). The direction of every `import` is toward the centre.

Concretely, in DevDigest the rings are (innermost → outermost):

1. **Core contracts & ports** — `@devdigest/shared` (Zod DTOs + port interfaces
   like `GitClient`, `GitHubClient`, `LLMProvider`, `Embedder`, `CodeIndex`,
   `SecretsProvider`, `AuthProvider`). Depends on nothing but `zod`.
2. **Pure domain engine** — `reviewer-core/` (`diff + inputs + injected LLM →
   Review`). **Zero I/O.** The only side effect is the injected `LLMProvider`.
3. **Application services** — `server/src/modules/*/service.ts`. Use-case
   orchestration. No HTTP, no SQL, no SDKs — reaches the world only through
   `Container` and ports.
4. **Infrastructure** — `server/src/modules/*/repository.ts` (Drizzle) +
   `server/src/adapters/*` (octokit, simple-git, openai, anthropic, ripgrep,
   ast-grep, depgraph, tokenizer, secrets, auth). Each implements a port.
5. **Transport / presentation** — `server/src/modules/*/routes.ts` (Fastify +
   Zod at the edge). Parses, maps status codes, delegates. No logic.
6. **Composition root** — `server/src/platform/container.ts`. The ONLY place
   allowed to name concrete classes and wire them to ports. Tests inject mocks
   via `ContainerOverrides`.

Full ring↔folder↔tool table: see [layer-map.md](layer-map.md).

## "Where does this code go?" — decision router

| What you're writing | Goes in | NOT allowed to touch |
|---|---|---|
| Parse request / set HTTP status / SSE | `modules/<f>/routes.ts` | business logic, raw SQL, SDKs |
| Orchestrate a use case (add/list/run…) | `modules/<f>/service.ts` | `fastify`, `drizzle`, `db`, any `adapters/*` concrete |
| A SQL query / table read or write | `modules/<f>/repository.ts` | anything but `db` + `db/schema` |
| Wrap an external SDK (GitHub, git, LLM…) | `adapters/<kind>/<impl>.ts` + a port in `shared` | another module's internals |
| A request/response shape or a port interface | `@devdigest/shared` (edit canonical, re-sync vendors) | anything outward |
| Pure review computation (scoring, grounding) | `reviewer-core/src/**` | DB, fs, network, GitHub, Fastify |
| Construct a concrete and bind it to a port | `platform/container.ts` only | scattered `new Concrete()` in services |
| A pure transform (parse URL, map row→DTO) | `modules/<f>/helpers.ts` | I/O of any kind |
| A literal / magic constant | `modules/<f>/constants.ts` | — |

Worked good/bad pairs from this codebase: see [examples.md](examples.md).

## Red flags — block these in review

- `import ... from 'drizzle-orm'` / `postgres` / `'../../db/...'` **outside a
  `repository.ts`**. SQL lives in exactly one ring.
- `import ... from 'fastify'`, or a `FastifyRequest`/`reply` parameter, **inside
  a `service.ts`**. Transport must not leak inward.
- `import { Octokit }` / `simpleGit` / `new OpenAI()` **inside a service**. Talk
  to the world through a port resolved from `Container`, never a raw SDK.
- `new ConcreteAdapter(...)` **anywhere but `container.ts`**. Construction is the
  composition root's job; everyone else receives an interface.
- Any `import` from `server/`, `node:fs`, `octokit`, `simple-git`, `postgres`,
  or `fastify` **inside `reviewer-core/`**. The engine stays pure.
- A `service.ts` importing **another module's `repository.ts`**. Cross-cutting
  repos (agents, reviews) are exposed on `Container` (`container.agentsRepo`),
  not reached into.
- A Zod schema defined **at a call site** instead of in `@devdigest/shared`.
  Validate once at the edge with the shared contract; trust the type inward
  ("parse, don't validate").

## Checklist — adding a new feature module

A feature module is a Fastify plugin built from the standard triple. Mirror
`modules/repos` (the reference):

1. `routes.ts` — `export default async function` plugin; `withTypeProvider<ZodTypeProvider>()`;
   validate with a `@devdigest/shared` schema; resolve tenancy via
   `getContext(app.container, req)`; delegate every branch to the service.
2. `service.ts` — `constructor(private container: Container)`; build its own
   `Repository(container.db)`; depend on ports via `container`, not concretes;
   no HTTP, no SQL.
3. `repository.ts` — `constructor(private db: Db)`; the only file touching this
   feature's table; **every query scoped by `workspaceId`** (tenancy guard).
4. `constants.ts` / `helpers.ts` — literals and pure transforms.
5. Register it: add one import + one entry in
   [modules/index.ts](../../../server/src/modules/index.ts). No other module changes.
6. Contracts go in `@devdigest/shared` first, then re-sync the vendored copies
   (`server/src/vendor/shared`, `client/src/vendor/shared`) — there's no auto-sync.

## Enforcement — make it mechanical, not just advice

This skill *guides*; `dependency-cruiser` (already a dependency of `server/`)
*enforces*. The dependency rule should fail the build, not rely on memory. The
ready-to-use ruleset + CI wiring is in [enforcement.md](enforcement.md). When you
add a layer-crossing rule to the code, add the matching `forbidden` rule there.

## Why this matters (and when to relax)

The payoff is testability and replaceability: services are unit-tested with mock
ports via `ContainerOverrides`; `reviewer-core` runs identically under the API
server and the CI runner because it only knows `LLMProvider`; swapping octokit,
the LLM vendor, or even Postgres touches one adapter, not the domain.

Don't over-rotate: this is layering discipline, not a mandate for ceremony.
Pure transforms stay in `helpers.ts`, not a new "use-case class"; a one-table
read is a `repository.ts` method, not a repository abstraction hierarchy. Keep
the rings; skip the boilerplate.

Background and sources: [SOURCES.md](SOURCES.md).
