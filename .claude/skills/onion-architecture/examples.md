# Examples — good vs bad, on DevDigest's own code

Each pair shows a layering violation (❌) and the in-repo pattern that fixes it
(✅). The ✅ examples are abridged from the reference module `modules/repos`.

---

## 1. Routes are transport-only

The route parses, scopes tenancy, maps the status code, and delegates. Nothing
else.

✅ — `modules/repos/routes.ts`
```ts
app.post('/repos', { schema: { body: RepoInput } }, async (req, reply) => {
  const { workspaceId, userId } = await getContext(app.container, req);
  const { repo, created } = await service.add(workspaceId, userId, req.body.url);
  reply.status(created ? 201 : 200);
  return repo;
});
```

❌ — business logic and persistence leaking into the edge
```ts
app.post('/repos', async (req, reply) => {
  const { owner, name } = parseRepoUrl(req.body.url);          // ← logic in transport
  const existing = await db.select().from(repos)               // ← SQL in transport
    .where(eq(repos.fullName, `${owner}/${name}`));
  if (existing.length) return reply.status(200).send(existing[0]);
  // ...
});
```
Why: `routes.ts` is ring 5. SQL is ring 4, parsing is a ring-3 use case. The
diff shape and validation belong to a `@devdigest/shared` schema (`RepoInput`),
not an inline check.

---

## 2. Services orchestrate through ports, never concretes

The service depends on `Container` and ports. It never imports `fastify`,
`drizzle`, or an SDK.

✅ — `modules/repos/service.ts`
```ts
export class RepoService {
  private repo: RepoRepository;
  constructor(private container: Container) {
    this.repo = new RepoRepository(container.db);
  }

  async runCloneJob(payload: CloneJobPayload): Promise<void> {
    const token = await this.container.secrets.get(GITHUB_TOKEN_SECRET);   // ← port
    const cloneUrl = token ? withGitHubToken(payload.url, token) : payload.url;
    const { path } = await this.container.git.clone(/* ... */);            // ← port
    await this.repo.updateClonePath(payload.repoId, path);                 // ← repository
  }
}
```

❌ — reaching for the SDK and the DB directly
```ts
import { simpleGit } from 'simple-git';        // ← SDK in a service
import { db } from '../../db/client.js';        // ← DB in a service

export class RepoService {
  async runCloneJob(payload: CloneJobPayload) {
    await simpleGit(dir).clone(payload.url);                    // ← bypasses GitClient port
    await db.update(repos).set({ clonePath: dir })              // ← bypasses repository
      .where(eq(repos.id, payload.repoId));
  }
}
```
Why: binding a service to `simple-git` and `drizzle` makes it untestable without
a real git binary and a real DB, and couples ring 3 to ring 4. Go through
`container.git` (the `GitClient` port) and `RepoRepository`. Tests then swap a
mock `GitClient` via `ContainerOverrides`.

---

## 3. Repositories are the only place that touches a table

One file owns one feature's table, and every query is scoped by `workspaceId`.

✅ — `modules/repos/repository.ts`
```ts
export class RepoRepository {
  constructor(private db: Db) {}

  async getById(workspaceId: string, id: string): Promise<RepoRow | undefined> {
    const [row] = await this.db.select().from(t.repos)
      .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, id)));   // ← tenancy guard
    return row;
  }
}
```

❌ — an unscoped query, or SQL scattered outside the repository
```ts
async getById(id: string) {
  const [row] = await this.db.select().from(t.repos)
    .where(eq(t.repos.id, id));     // ← no workspaceId → cross-tenant leak
  return row;
}
```
Why: dropping `workspaceId` breaks tenant isolation. Keeping all `repos` queries
in this one file is what makes that guarantee auditable.

---

## 4. Adapters implement a port from the core

The concrete wraps the SDK and satisfies an interface owned by `@devdigest/shared`.

✅ — `adapters/git/simple-git.ts`
```ts
import { simpleGit, type SimpleGit } from 'simple-git';
import type { GitClient, RepoRef, CloneOptions } from '@devdigest/shared';

export class SimpleGitClient implements GitClient {   // ← satisfies the port
  constructor(private cloneDir: string) { /* ... */ }
  clonePathFor(repo: RepoRef): string { /* ... */ }
}
```

❌ — an adapter that invents its own surface (no port)
```ts
export class SimpleGitClient {            // ← implements nothing
  async doClone(url: string) { /* ... */ }   // ← name only this file knows
}
```
Why: without `implements GitClient`, services would couple to this class's ad-hoc
shape. The port is the contract; the adapter is swappable behind it.

---

## 5. Concretes are constructed only in the composition root

`container.ts` is the one place that names concrete classes and binds them to
ports. Everyone else receives the interface.

✅ — `platform/container.ts`
```ts
get git(): GitClient {
  if (this.overrides.git) return this.overrides.git;          // ← tests inject a mock
  this._git ??= new SimpleGitClient(this.config.cloneDir);    // ← single construction site
  return this._git;
}

async llm(id: 'openai' | 'anthropic' | 'openrouter'): Promise<LLMProvider> {
  const injected = this.overrides.llm?.[id];
  if (injected) return injected;
  // ...builds from the secret key, cached
}
```

❌ — `new` scattered through a service
```ts
export class ReviewService {
  private github = new OctokitGitHubClient(process.env.GITHUB_TOKEN!);  // ← wrong ring
}
```
Why: construction in a service hard-wires the secret source and the concrete,
defeating `ContainerOverrides` and the secret-cache invalidation the container
manages. Ask the container: `await this.container.github()`.

---

## 6. reviewer-core stays pure

The engine's only side effect is the injected `LLMProvider`. No DB, no GitHub,
no fs, no Fastify.

✅ — the engine receives what it needs as resolved strings + a port
```ts
// reviewer-core/src/review/run.ts
export async function reviewPullRequest(input: ReviewInput, llm: LLMProvider): Promise<Review> {
  const result = await llm.completeStructured(/* ... */);   // ← the ONLY side effect
  return groundFindings(result, input.diff);                // ← pure
}
```

❌ — the engine fetching its own inputs
```ts
import { Octokit } from 'octokit';                  // ← I/O in the pure core
export async function reviewPullRequest(prId: string) {
  const pr = await new Octokit().rest.pulls.get(/* ... */);   // ← network in ring 2
}
```
Why: callers (API server *and* CI runner) do all fetching and persistence and
pass **resolved** strings (skill bodies, memory, specs) in. That's why the same
engine runs unchanged in both. An `octokit` import here breaks the contract — and
`dependency-cruiser` should reject it (see [enforcement.md](enforcement.md)).

---

## 7. Cross-cutting repos come from the container, not a sibling module

Shared entities (agents, reviews/runs) are exposed on `Container`; a service does
not import another module's `repository.ts`.

✅
```ts
const agents = this.container.agentsRepo;     // exposed in the composition root
const reviews = this.container.reviewRepo;
```

❌
```ts
import { AgentsRepository } from '../agents/repository.js';   // ← reaching into a sibling
const agents = new AgentsRepository(this.container.db);
```
Why: `container.ts` constructs the cross-cutting repositories once, in the
composition root, so consuming modules stay decoupled from each other's internals.
