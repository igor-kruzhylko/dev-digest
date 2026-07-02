import 'dotenv/config';
import { createDb, type Db } from './client.js';
import * as t from './schema.js';
import { eq, and } from 'drizzle-orm';
import {
  GENERAL_REVIEWER_PROMPT,
  SECURITY_REVIEWER_PROMPT,
  PERFORMANCE_REVIEWER_PROMPT,
  TEST_QUALITY_REVIEWER_PROMPT,
  API_CONTRACT_REVIEWER_PROMPT,
} from './seed-prompts.js';
import {
  PR_QUALITY_RUBRIC_BODY,
  PR_QUALITY_RUBRIC_HISTORY,
  SECRET_LEAKAGE_GATE_BODY,
  LETHAL_TRIFECTA_BODY,
  TEST_QUALITY_RUBRIC_BODY,
  API_CONTRACT_GATE_BODY,
} from './seed-skills.js';
import { isDirectRun } from './is-direct-run.js';

/** Default provider/model for the built-in reviewer agents. */
const DEFAULT_PROVIDER = 'openrouter' as const;
const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash';

// ---- Skills-lesson demo PR patches (unified-diff hunks; diff-loader.ts
// synthesizes the `diff --git`/`---`/`+++` headers from pr_files.path) ----

const DISCOUNT_TS_PATCH = `@@ -1,8 +1,24 @@
 export interface DiscountInput {
   orderTotal: number;
   isPremiumMember: boolean;
 }

+/**
+ * Compute the order discount rate. Premium members get a bigger break once
+ * they cross the $100 threshold; everyone else gets a flat mid-tier discount
+ * above $100 and nothing below it.
+ */
+export function calculateDiscount(input: DiscountInput): number {
+  const { orderTotal, isPremiumMember } = input;
+  if (isPremiumMember && orderTotal > 100) {
+    return 0.2;
+  }
+  if (orderTotal > 100) {
+    return 0.1;
+  }
+  return 0;
+}
+
 export function applyDiscount(total: number, rate: number): number {
   return total * (1 - rate);
 }`;

const DISCOUNT_TEST_TS_PATCH = `@@ -1,8 +1,15 @@
 import { describe, it, expect } from 'vitest';
-import { applyDiscount } from './discount';
+import { applyDiscount, calculateDiscount } from './discount';

 describe('applyDiscount', () => {
   it('reduces the total by the given rate', () => {
     expect(applyDiscount(100, 0.1)).toBe(90);
   });
 });
+
+describe('calculateDiscount', () => {
+  it('gives premium members 20% off large orders', () => {
+    const rate = calculateDiscount({ orderTotal: 150, isPremiumMember: true });
+    expect(rate).toBe(0.2);
+  });
+});`;

const PULLS_ROUTE_PATCH = `@@ -10,6 +10,5 @@
-  app.get('/repos/:id/pulls', { schema: { params: IdParams, querystring: PullsQuery } }, async (req) => {
-    const { workspaceId } = await getContext(app.container, req);
-    const { status } = req.query;
-    const items = await service.listForRepo(workspaceId, req.params.id, { status });
-    return { items, total: items.length };
-  });
+  app.get('/repos/:id/pulls', { schema: { params: IdParams } }, async (req) => {
+    const { workspaceId } = await getContext(app.container, req);
+    const items = await service.listForRepo(workspaceId, req.params.id);
+    return items;
+  });`;

/**
 * Seed the starter's demo data. Idempotent: re-running upserts the default
 * workspace/user and the demo fixtures.
 *
 * Seeds: default workspace + system user + membership, default settings,
 * demo repo (acme/payments-api), PR #482 with files/commits, a sample review
 * with a few findings, and the three built-in agents (General + Security +
 * Performance), all on the default openrouter/deepseek-v4-flash provider+model.
 *
 * Course lessons populate the other tables (skills, conventions, memory, eval,
 * …) once their features are built — they start empty here.
 */

export const DEFAULT_WORKSPACE_NAME = 'default';
export const SYSTEM_USER_EMAIL = 'you@local';

export async function seed(db: Db): Promise<{ workspaceId: string; userId: string }> {
  // ---- workspace + user (no-auth defaults) ----
  let [ws] = await db
    .select()
    .from(t.workspaces)
    .where(eq(t.workspaces.name, DEFAULT_WORKSPACE_NAME));
  if (!ws) {
    [ws] = await db
      .insert(t.workspaces)
      .values({ name: DEFAULT_WORKSPACE_NAME })
      .returning();
  }
  const workspaceId = ws!.id;

  let [user] = await db.select().from(t.users).where(eq(t.users.email, SYSTEM_USER_EMAIL));
  if (!user) {
    [user] = await db
      .insert(t.users)
      .values({ email: SYSTEM_USER_EMAIL, name: 'You' })
      .returning();
  }
  const userId = user!.id;

  await db
    .insert(t.workspaceMembers)
    .values({ workspaceId, userId, role: 'owner' })
    .onConflictDoNothing();

  // ---- default settings ----
  const defaultSettings: Record<string, unknown> = {
    polling_interval_min: 5,
    theme: 'dark',
    density: 'regular',
    sync_to_folder: true,
  };
  for (const [key, value] of Object.entries(defaultSettings)) {
    await db
      .insert(t.settings)
      .values({ workspaceId, userId, key, value })
      .onConflictDoNothing();
  }

  // ---- demo repo (acme/payments-api) ----
  let [repo] = await db
    .select()
    .from(t.repos)
    .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.fullName, 'acme/payments-api')));
  if (!repo) {
    [repo] = await db
      .insert(t.repos)
      .values({
        workspaceId,
        owner: 'acme',
        name: 'payments-api',
        fullName: 'acme/payments-api',
        defaultBranch: 'main',
        clonePath: null,
        createdBy: userId,
      })
      .returning();
  }
  const repoId = repo!.id;

  // ---- PR #482 (rate limiting) ----
  let [pr] = await db
    .select()
    .from(t.pullRequests)
    .where(and(eq(t.pullRequests.repoId, repoId), eq(t.pullRequests.number, 482)));
  if (!pr) {
    [pr] = await db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId,
        number: 482,
        title: 'Add rate limiting to public API endpoints',
        author: 'marisa.koch',
        branch: 'feat/rate-limit-public',
        base: 'main',
        headSha: 'a1b2c3d4e5f6',
        additions: 247,
        deletions: 38,
        filesCount: 9,
        status: 'needs_review',
        body: 'Add rate limiting to public API endpoints to prevent abuse from unauthenticated clients.',
      })
      .returning();

    // pr_files (subset)
    await db.insert(t.prFiles).values([
      { prId: pr!.id, path: 'src/middleware/ratelimit.ts', additions: 84, deletions: 0 },
      { prId: pr!.id, path: 'src/api/public/webhooks.ts', additions: 31, deletions: 6 },
      { prId: pr!.id, path: 'src/config.ts', additions: 4, deletions: 0 },
      { prId: pr!.id, path: 'src/api/users.ts', additions: 7, deletions: 2 },
    ]);

    // pr_commits
    await db.insert(t.prCommits).values({
      prId: pr!.id,
      sha: 'a1b2c3d4e5f6',
      message: 'Add token-bucket rate limiter',
      author: 'marisa.koch',
    });

    // a sample review + findings so the PR shows results before the first run
    const [review] = await db
      .insert(t.reviews)
      .values({
        workspaceId,
        prId: pr!.id,
        kind: 'review',
        verdict: 'request_changes',
        summary:
          'Solid middleware approach, but a Stripe secret key is committed in plaintext and the user-list endpoint introduces an N+1 query under the new limiter.',
        score: 61,
        model: 'seed',
      })
      .returning();

    await db.insert(t.findings).values([
      {
        reviewId: review!.id,
        file: 'src/config.ts',
        startLine: 12,
        endLine: 12,
        severity: 'CRITICAL',
        category: 'security',
        title: 'Hardcoded Stripe secret key in commit',
        rationale: 'Line 12 contains a literal `sk_live_` Stripe secret key.',
        suggestion: 'Move to env var and rotate the key immediately.',
        confidence: 0.98,
      },
      {
        reviewId: review!.id,
        file: 'src/api/users.ts',
        startLine: 45,
        endLine: 52,
        severity: 'WARNING',
        category: 'perf',
        title: 'N+1 query in user list endpoint',
        rationale: 'Loop issues one query per user → N+1.',
        suggestion: 'Use a single IN query and group in memory.',
        confidence: 0.86,
      },
    ]);
  }

  // ---- built-in agents (the three starter presets) ----
  // Prompt bodies live in ./seed-prompts.ts (mirrored in docs/agent-prompts/*.md).
  const seedAgents: Array<typeof t.agents.$inferInsert> = [
    {
      workspaceId,
      name: 'General Reviewer',
      description: 'Reviews a PR diff for bugs, correctness, and clarity.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: GENERAL_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
    {
      workspaceId,
      name: 'Security Reviewer',
      description: 'Flags secrets, injection, SSRF and the lethal trifecta before merge.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: SECURITY_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
    {
      workspaceId,
      name: 'Performance Reviewer',
      description: 'Catches N+1 queries, missing indexes, and hot-path allocations.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: PERFORMANCE_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
  ];
  for (const a of seedAgents) {
    const [existing] = await db
      .select()
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.name, a.name)));
    if (!existing) await db.insert(t.agents).values(a);
  }

  // ---- skills (Skills lesson demo + control experiment) ----
  // Bodies live in ./seed-skills.ts. All seeded skills are enabled:true — the
  // "imported ⇒ disabled" rule only applies to the live UI import path, so the
  // control experiment works right after `db:seed`.
  const seedSkills: Array<{
    name: string;
    description: string;
    type: 'rubric' | 'convention' | 'security' | 'custom';
    source: 'manual' | 'imported_url' | 'extracted' | 'community';
    body: string;
    version?: number;
  }> = [
    {
      name: 'pr-quality-rubric',
      description: 'General PR quality checklist: correctness, tests, docs, naming, security.',
      type: 'rubric',
      source: 'manual',
      body: PR_QUALITY_RUBRIC_BODY,
      version: PR_QUALITY_RUBRIC_HISTORY.length + 1,
    },
    {
      name: 'secret-leakage-gate',
      description: 'Flags any literal secret/credential introduced in the diff.',
      type: 'security',
      source: 'manual',
      body: SECRET_LEAKAGE_GATE_BODY,
    },
    {
      name: 'lethal-trifecta',
      description: 'Conservative classification rule for the AI-agent lethal-trifecta risk.',
      type: 'security',
      source: 'manual',
      body: LETHAL_TRIFECTA_BODY,
    },
    {
      // Marked source:'extracted' to represent the import path's origin; the
      // live preview→save import flow is validated separately, through the UI.
      name: 'test-quality-rubric',
      description: 'Flags untested branches, boundaries, over-mocking, and flaky tests.',
      type: 'rubric',
      source: 'extracted',
      body: TEST_QUALITY_RUBRIC_BODY,
    },
    {
      name: 'api-contract-gate',
      description: 'Flags breaking route request/response contract changes.',
      type: 'rubric',
      source: 'manual',
      body: API_CONTRACT_GATE_BODY,
    },
  ];

  const skillIdByName = new Map<string, string>();
  for (const sk of seedSkills) {
    const [existing] = await db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.name, sk.name)));
    if (existing) {
      skillIdByName.set(sk.name, existing.id);
      continue;
    }
    const [row] = await db
      .insert(t.skills)
      .values({
        workspaceId,
        name: sk.name,
        description: sk.description,
        type: sk.type,
        source: sk.source,
        body: sk.body,
        enabled: true,
        version: sk.version ?? 1,
      })
      .returning();
    skillIdByName.set(sk.name, row!.id);

    if (sk.name === 'pr-quality-rubric') {
      // Version history for the Versions-tab demo (~5 versions total).
      for (let i = 0; i < PR_QUALITY_RUBRIC_HISTORY.length; i++) {
        const h = PR_QUALITY_RUBRIC_HISTORY[i]!;
        await db.insert(t.skillVersions).values({
          skillId: row!.id,
          version: i + 1,
          body: h.body,
          label: h.label,
        });
      }
      await db.insert(t.skillVersions).values({
        skillId: row!.id,
        version: PR_QUALITY_RUBRIC_HISTORY.length + 1,
        body: sk.body,
        label: 'Added Security cross-check',
      });
    } else {
      await db.insert(t.skillVersions).values({
        skillId: row!.id,
        version: 1,
        body: sk.body,
        label: null,
      });
    }
  }

  // ---- Skills-lesson demo agents ----
  const skillsLessonAgents: Array<typeof t.agents.$inferInsert> = [
    {
      workspaceId,
      name: 'Test Quality Reviewer',
      description: 'Flags uncovered branches, missed corner cases, over-mocking, and flaky tests.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: TEST_QUALITY_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
    {
      workspaceId,
      name: 'API Contract Reviewer',
      description: 'Flags breaking route request/response contract changes.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: API_CONTRACT_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
  ];
  const agentIdByName = new Map<string, string>();
  for (const a of skillsLessonAgents) {
    const [existing] = await db
      .select()
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.name, a.name)));
    if (existing) {
      agentIdByName.set(a.name as string, existing.id);
      continue;
    }
    const [row] = await db.insert(t.agents).values(a).returning();
    agentIdByName.set(a.name as string, row!.id);
  }

  // ---- skills -> agents links (ordered; seeded default = WITH skills, so the
  // demo can disable/unlink to show the miss) ----
  const skillAgentLinks: Array<{ agentName: string; skillName: string }> = [
    { agentName: 'Test Quality Reviewer', skillName: 'test-quality-rubric' },
    { agentName: 'API Contract Reviewer', skillName: 'api-contract-gate' },
  ];
  for (const link of skillAgentLinks) {
    const agentId = agentIdByName.get(link.agentName);
    const skillId = skillIdByName.get(link.skillName);
    if (!agentId || !skillId) continue;
    await db.insert(t.agentSkills).values({ agentId, skillId, order: 0 }).onConflictDoNothing();
  }

  // ---- demo PR #501: happy-path-only test (Test Quality Reviewer demo) ----
  let [prTestQuality] = await db
    .select()
    .from(t.pullRequests)
    .where(and(eq(t.pullRequests.repoId, repoId), eq(t.pullRequests.number, 501)));
  if (!prTestQuality) {
    [prTestQuality] = await db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId,
        number: 501,
        title: 'Add premium discount tier',
        author: 'devon.oakes',
        branch: 'feat/premium-discount',
        base: 'main',
        headSha: 'b2c3d4e5f6a1',
        additions: 24,
        deletions: 1,
        filesCount: 2,
        status: 'needs_review',
        body: 'Adds a premium-member discount tier for large orders.',
      })
      .returning();

    await db.insert(t.prFiles).values([
      {
        prId: prTestQuality!.id,
        path: 'src/pricing/discount.ts',
        additions: 16,
        deletions: 0,
        patch: DISCOUNT_TS_PATCH,
      },
      {
        prId: prTestQuality!.id,
        path: 'src/pricing/discount.test.ts',
        additions: 8,
        deletions: 1,
        patch: DISCOUNT_TEST_TS_PATCH,
      },
    ]);
  }

  // ---- demo PR #502: route signature change (API Contract Reviewer demo) ----
  let [prApiContract] = await db
    .select()
    .from(t.pullRequests)
    .where(and(eq(t.pullRequests.repoId, repoId), eq(t.pullRequests.number, 502)));
  if (!prApiContract) {
    [prApiContract] = await db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId,
        number: 502,
        title: 'Simplify pull list endpoint',
        author: 'priya.raman',
        branch: 'refactor/pulls-list-shape',
        base: 'main',
        headSha: 'c3d4e5f6a1b2',
        additions: 5,
        deletions: 6,
        filesCount: 1,
        status: 'needs_review',
        body: 'Drops the now-unused status filter and returns the list directly.',
      })
      .returning();

    await db.insert(t.prFiles).values({
      prId: prApiContract!.id,
      path: 'src/api/pulls.ts',
      additions: 5,
      deletions: 6,
      patch: PULLS_ROUTE_PATCH,
    });
  }

  return { workspaceId, userId };
}

// CLI entrypoint
if (isDirectRun(import.meta.url)) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const handle = createDb(url);
  seed(handle.db)
    .then(async (r) => {
      console.log('✓ seeded', r);
      await handle.close();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('✗ seed failed:', err);
      await handle.close();
      process.exit(1);
    });
}
