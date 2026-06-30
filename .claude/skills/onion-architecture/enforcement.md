# Enforcement — make the dependency rule fail the build

A skill *guides*; it can't *force*. The force comes from `dependency-cruiser`
(already in `server/`'s dependencies — today it's used programmatically by the
repo-intel depgraph adapter, not yet as an architecture gate). This file adds a
**CLI ruleset** that turns each ring crossing into a build error.

> Status: PROPOSED. Land the config, get a green baseline against current code,
> then wire it into CI. When you introduce a new layer boundary in code, add the
> matching `forbidden` rule here.

## 1. The ruleset — `server/.dependency-cruiser.cjs`

```js
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'service-no-drizzle',
      comment: 'Application services (ring 3) must not touch SQL. Use a repository.',
      severity: 'error',
      from: { path: 'src/modules/[^/]+/service\\.ts$' },
      to:   { path: '(^|/)node_modules/(drizzle-orm|postgres)|src/db/' },
    },
    {
      name: 'service-no-fastify',
      comment: 'Transport (ring 5) must not leak into services (ring 3).',
      severity: 'error',
      from: { path: 'src/modules/[^/]+/service\\.ts$' },
      to:   { path: '(^|/)node_modules/(fastify|@fastify|fastify-sse-v2|fastify-type-provider-zod)(/|$)' },
    },
    {
      name: 'service-no-sdk',
      comment: 'Services reach the world through ports, never a raw SDK.',
      severity: 'error',
      from: { path: 'src/modules/[^/]+/service\\.ts$' },
      to:   { path: '(^|/)node_modules/(octokit|simple-git|openai|@anthropic-ai)(/|$)' },
    },
    {
      name: 'service-no-adapter-concrete',
      comment: 'Services depend on ports from @devdigest/shared, not concrete adapters. Resolve via Container.',
      severity: 'error',
      from: { path: 'src/modules/[^/]+/service\\.ts$' },
      to:   { path: 'src/adapters/' },
    },
    {
      name: 'routes-no-sql',
      comment: 'Routes (ring 5) parse + delegate. No SQL.',
      severity: 'error',
      from: { path: 'src/modules/[^/]+/routes\\.ts$' },
      to:   { path: '(^|/)node_modules/(drizzle-orm|postgres)|src/db/' },
    },
    {
      name: 'drizzle-only-in-repository',
      comment: 'Drizzle is confined to repositories + src/db. No SQL elsewhere.',
      severity: 'error',
      from: { path: 'src/modules/', pathNot: '(repository\\.ts$|/repository/)' },
      to:   { path: '(^|/)node_modules/drizzle-orm(/|$)' },
    },
    {
      name: 'no-cross-module-repository',
      comment: 'A module must not import a sibling module\'s repository. Use container.agentsRepo / reviewRepo.',
      severity: 'error',
      from: { path: 'src/modules/([^/]+)/' },
      to:   { path: 'src/modules/([^/]+)/repository', pathNot: 'src/modules/$1/' },
    },
    {
      name: 'no-circular',
      comment: 'Circular dependencies break the inward-only flow.',
      severity: 'error',
      from: {},
      to:   { circular: true },
    },
    {
      name: 'no-orphans',
      comment: 'Dead modules — delete or wire them in.',
      severity: 'warn',
      from: { orphan: true, pathNot: '\\.(d\\.ts|test\\.ts)$' },
      to:   {},
    },
  ],
  options: {
    doNotFollow: { path: '(node_modules|clones|src/db/migrations|src/vendor)' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
```

Notes:
- `doNotFollow` skips `clones/**` (third-party input — never index) and the
  vendored contracts / generated migrations, per the repo's do-not-touch list.
- `tsPreCompilationDeps: true` + `tsConfig` make it resolve `@devdigest/shared`
  and `@devdigest/reviewer-core` through the tsconfig path aliases, so the
  cross-package boundaries are visible even though this isn't a workspace.

## 2. The pure-core rule — `reviewer-core/.dependency-cruiser.cjs`

`reviewer-core` is a separate package, so it gets its own tiny config. Its only
job: prove the engine has no I/O.

```js
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-stays-pure',
      comment: 'reviewer-core has NO I/O — only the injected LLMProvider. No DB, fs, GitHub, or Fastify.',
      severity: 'error',
      from: { path: '^src/' },
      to:   { path: '(^|/)node_modules/(fastify|@fastify|drizzle-orm|postgres|octokit|simple-git)(/|$)|^node:(fs|net|http|https|child_process)' },
    },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: { tsPreCompilationDeps: true, tsConfig: { fileName: 'tsconfig.json' } },
};
```
(`reviewer-core` would need `dependency-cruiser` added to its devDependencies.)

## 3. Run it

Add to `server/package.json` (and an equivalent in `reviewer-core/`):

```jsonc
"scripts": {
  "arch": "depcruise src --config .dependency-cruiser.cjs",
  "arch:graph": "depcruise src --config .dependency-cruiser.cjs --output-type dot | dot -T svg > arch.svg"
}
```

- `pnpm arch` — fails on any violation (exit ≠ 0). This is the gate.
- `pnpm arch:graph` — renders the dependency graph for review (needs Graphviz).

## 4. Wire into CI

Run `arch` alongside `typecheck` in the server + reviewer-core jobs so a
layering violation blocks the merge, not just a reviewer's attention. See
[TESTING.md](../../../TESTING.md) for where the CI matrix lives.

## 5. Rollout order

1. Land both configs.
2. `pnpm arch` in each package; if the current code is already clean (it should
   be — these rules describe the existing design), you have a green baseline.
3. If anything trips, it's either a real violation to fix or a legitimate
   exception — encode exceptions narrowly with `pathNot`, never by deleting the
   rule.
4. Add `arch` to CI. From then on the architecture is enforced mechanically.
