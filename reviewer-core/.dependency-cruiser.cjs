/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-stays-pure',
      comment:
        'reviewer-core has NO I/O — the only side effect is the injected LLMProvider. ' +
        'No DB, fs, network, GitHub, or Fastify.',
      severity: 'error',
      from: { path: '^src/' },
      to: {
        path:
          '(^|/)node_modules/(fastify|@fastify|drizzle-orm|postgres|octokit|simple-git)(/|$)' +
          '|^node:(fs|net|http|https|child_process)',
      },
    },
    {
      name: 'no-circular',
      comment: 'Circular dependencies break the inward-only flow.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
