# Layer map — DevDigest rings ↔ folders ↔ tools

The canonical reference for *where each ring lives* and *which tool belongs to
it*. When unsure where code goes, find the row, then obey its dependency
constraint.

## Rings → folders

| Ring (inner → outer) | What it is in DevDigest | Lives in | May depend on | Must NOT depend on |
|---|---|---|---|---|
| 1. Core contracts & ports | Zod DTOs + port interfaces (`GitClient`, `GitHubClient`, `LLMProvider`, `Embedder`, `CodeIndex`, `SecretsProvider`, `AuthProvider`) | `@devdigest/shared` — canonical, vendored to `server/src/vendor/shared`, `client/src/vendor/shared` | `zod` only | everything outward |
| 2. Pure domain engine | The review pipeline: `diff + agent inputs + injected LLM → grounded Review` | `reviewer-core/src/**` (entry `src/review/run.ts`, gate `src/grounding.ts`) | ring 1 (ports/types) | DB, fs, network, GitHub, Fastify, any adapter |
| 3. Application services | Use-case orchestration per feature | `server/src/modules/*/service.ts` | rings 1–2, `Container`, ports | `fastify`, `drizzle-orm`, `postgres`, `db/*`, concrete `adapters/*` |
| 4. Infrastructure | Persistence + external-world adapters | `server/src/modules/*/repository.ts`, `server/src/adapters/*` | rings 1–2, the SDK it wraps | other modules' internals; HTTP layer |
| 5. Transport / presentation | HTTP/SSE edge | `server/src/modules/*/routes.ts` | ring 3 (its service), ring 1 (schemas) | raw SQL, SDKs, business logic |
| 6. Composition root | DI wiring; binds concretes → ports | `server/src/platform/container.ts` | everything (it's the outermost) | — (but nothing may depend *on it* except routes via `app.container`) |

Supporting platform code (`server/src/platform/*`: `jobs.ts`, `sse.ts`,
`errors.ts`, `config.ts`, `structured.ts`, `price-book.ts`) is infrastructure
the composition root assembles — treat it as ring 4/6, never import it into
`reviewer-core`.

## Tools → ring

Every backend dependency from [server/package.json](../../../server/package.json)
mapped to its ring and its placement rule:

| Tool / package | Ring | Rule |
|---|---|---|
| `fastify`, `@fastify/cors`, `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/autoload` | 5 Transport | Only in `routes.ts` and server bootstrap. `FastifyInstance`/`reply` never passed inward. |
| `fastify-type-provider-zod` | 5 Transport | Wires ring-1 Zod schemas to the edge. Schemas themselves stay in `shared`. |
| `fastify-sse-v2` | 5 Transport | Streaming is an edge concern; the `RunBus` it reads is platform infra. |
| `zod` | 1 Core | Contracts in `@devdigest/shared`. Parse at the edge, trust the inferred type inward. |
| `drizzle-orm`, `postgres` | 4 Infra | Only in `repository.ts` (+ `db/*`). Every query scoped by `workspaceId`. |
| `drizzle-kit` (dev) | 4 Infra | `db:generate` only; never hand-edit `db/migrations/**`. |
| `octokit` | 4 Infra | Behind the `GitHubClient` port (`adapters/github/octokit.ts`). |
| `simple-git` | 4 Infra | Behind the `GitClient` port (`adapters/git/simple-git.ts`). |
| `@anthropic-ai/sdk`, `openai` | 4 Infra | Behind the `LLMProvider` port (`adapters/llm/*`). Same port the pure engine consumes. |
| `@ast-grep/napi`, `@vscode/ripgrep` | 4 Infra | Behind `CodeIndex` / astgrep adapters. |
| `dependency-cruiser` | — Enforcement | Not a ring — the tool that mechanically forbids inward→outward imports. See [enforcement.md](enforcement.md). |
| `graphology`, `graphology-metrics` | 4 Infra | Behind the `DepGraph` adapter (repo-intel pipeline). |
| `js-tiktoken` | 4 Infra | Behind the `Tokenizer` adapter. |
| `p-queue` | 4/6 Infra | Drives `JobRunner` (platform). Background jobs are edge orchestration, not domain. |
| `dotenv` | 6 Root | Config loading at bootstrap only. |
| `testcontainers`, `@testcontainers/postgresql`, `vitest` (dev) | Tests | `*.it.test.ts` = DB-backed; everything else hermetic via `ContainerOverrides` mocks. |

## Ports defined today

The interfaces in `@devdigest/shared` (`vendor/shared/adapters.ts`) that every
adapter implements and every service depends on:

| Port | Implemented by | Resolved via |
|---|---|---|
| `GitClient` | `SimpleGitClient` | `container.git` |
| `GitHubClient` | `OctokitGitHubClient` | `await container.github()` |
| `LLMProvider` | `OpenAIProvider`, `AnthropicProvider`, `OpenRouterProvider` | `await container.llm(id)` |
| `Embedder` | `OpenAIEmbedder` | `await container.embedder()` |
| `CodeIndex` | `RipgrepCodeIndex` | `container.codeIndex` |
| `SecretsProvider` | `LocalSecretsProvider` | `container.secrets` |
| `AuthProvider` | `LocalNoAuthProvider` | `container.auth` |

Adding a new external dependency? Define its port in `@devdigest/shared` first,
implement it in `adapters/<kind>/`, then resolve it from `container.ts`. Services
get the interface, never the constructor.
