/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'service-no-drizzle',
      comment: 'Application services (ring 3) must not touch SQL. Use a repository. (db/rows.ts is shared row TYPES, allowed.)',
      severity: 'error',
      from: { path: 'src/modules/[^/]+/service\\.ts$' },
      to: { path: '(^|/)node_modules/(drizzle-orm|postgres)|src/db/', pathNot: 'src/db/rows\\.ts$' },
    },
    {
      name: 'service-no-fastify',
      comment: 'Transport (ring 5) must not leak into services (ring 3).',
      severity: 'error',
      from: { path: 'src/modules/[^/]+/service\\.ts$' },
      to: { path: '(^|/)node_modules/(fastify|@fastify|fastify-sse-v2|fastify-type-provider-zod)(/|$)' },
    },
    {
      name: 'service-no-sdk',
      comment: 'Services reach the world through ports, never a raw SDK.',
      severity: 'error',
      from: { path: 'src/modules/[^/]+/service\\.ts$' },
      to: { path: '(^|/)node_modules/(octokit|simple-git|openai|@anthropic-ai)(/|$)' },
    },
    {
      name: 'service-no-adapter-concrete',
      comment:
        'Services depend on ports from @devdigest/shared, not concrete adapters. Resolve via Container. ' +
        'EXCEPTION: repo-intel is the documented in-process indexer (see src/modules/repo-intel/CLAUDE.md) ' +
        'that orchestrates low-level index adapters directly.',
      severity: 'error',
      from: { path: 'src/modules/[^/]+/service\\.ts$', pathNot: 'src/modules/repo-intel/service\\.ts$' },
      to: { path: 'src/adapters/' },
    },
    {
      name: 'routes-no-sql',
      comment: 'Routes (ring 5) parse + delegate. No SQL.',
      severity: 'error',
      from: { path: 'src/modules/[^/]+/routes\\.ts$' },
      to: { path: '(^|/)node_modules/(drizzle-orm|postgres)|src/db/' },
    },
    {
      name: 'drizzle-only-in-repository',
      comment: 'Drizzle is confined to repositories + src/db. No SQL elsewhere.',
      severity: 'error',
      from: { path: 'src/modules/', pathNot: '(repository\\.ts$|/repository/)' },
      to: { path: '(^|/)node_modules/drizzle-orm(/|$)' },
    },
    {
      name: 'no-cross-module-repository',
      comment: "A module must not import a sibling module's repository. Use container.agentsRepo / reviewRepo.",
      severity: 'error',
      from: { path: 'src/modules/([^/]+)/' },
      to: { path: 'src/modules/([^/]+)/repository', pathNot: 'src/modules/$1/' },
    },
    {
      name: 'no-circular',
      comment:
        'Circular dependencies break the inward-only flow. EXCEPTION: cycles that pass ' +
        'through the composition root (platform/container.ts) are allowed — the root ' +
        'legitimately constructs the facades (e.g. repo-intel) that reference it back.',
      severity: 'error',
      from: {},
      to: { circular: true, viaNot: 'src/platform/container\\.ts$' },
    },
    {
      name: 'no-orphans',
      comment: 'Dead modules — delete or wire them in.',
      severity: 'warn',
      from: { orphan: true, pathNot: '\\.(d\\.ts|test\\.ts)$' },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: '(node_modules|clones|src/db/migrations|src/vendor)' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
