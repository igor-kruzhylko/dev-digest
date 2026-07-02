import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { waitForPrRuns } from './helpers/runs.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import { MockLLMProvider, MockEmbedder, MockGitClient } from '../src/adapters/mocks.js';
import { AgentsRepository } from '../src/modules/agents/repository.js';
import * as t from '../src/db/schema.js';
import type { Review } from '@devdigest/shared';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

const DIFF = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -10,3 +10,4 @@
   port: 3000,
+  stripeKey: "sk_live_xxx",
   redisUrl: x,`;

const REVIEW_FIXTURE: Review = {
  verdict: 'approve',
  summary: 'Looks fine.',
  score: 90,
  findings: [],
};

/**
 * Phase 2 — agent ↔ skill binding (set/reorder, cross-workspace rejection,
 * global-enable filter) and the run-executor wiring that makes linked +
 * enabled skills actually show up in the review prompt (`prompt_assembly.skills`)
 * and the Live Log ("Injecting N linked skill block(s)").
 */
d('Agent Skills binding + injection (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    workspaceId = ws!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function appWith(structured: unknown = REVIEW_FIXTURE) {
    return buildApp({
      config: config(),
      db: pg.handle.db,
      overrides: {
        embedder: new MockEmbedder(),
        git: new MockGitClient({ diff: DIFF }),
        llm: { openai: new MockLLMProvider('openai', { structured }) },
      },
    });
  }

  async function createAgent(app: Awaited<ReturnType<typeof appWith>>, name: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/agents',
      payload: { name, provider: 'openai', model: 'gpt-4.1', system_prompt: 'Review the diff.' },
    });
    return res.json();
  }

  async function createSkill(
    app: Awaited<ReturnType<typeof appWith>>,
    name: string,
    body: string,
    enabled = true,
  ) {
    const res = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: { name, description: 'test skill', type: 'rubric', body, enabled },
    });
    return res.json();
  }

  it('set/reorder round-trip: POST /agents/:id/skills persists the given order', async () => {
    const app = await appWith();
    const agent = await createAgent(app, 'RoundTrip Agent');
    const s1 = await createSkill(app, 'Skill One', 'Body one');
    const s2 = await createSkill(app, 'Skill Two', 'Body two');

    const set = await app.inject({
      method: 'POST',
      url: `/agents/${agent.id}/skills`,
      payload: { skill_ids: [s2.id, s1.id] },
    });
    expect(set.statusCode).toBe(200);
    expect(set.json().map((l: { skill_id: string }) => l.skill_id)).toEqual([s2.id, s1.id]);

    const get = (await app.inject({ method: 'GET', url: `/agents/${agent.id}/skills` })).json();
    expect(get.map((l: { skill_id: string; order: number }) => l.skill_id)).toEqual([s2.id, s1.id]);
    expect(get.map((l: { order: number }) => l.order)).toEqual([0, 1]);

    // Re-ordering (drop s2, keep s1 only) replaces the whole set.
    const reordered = await app.inject({
      method: 'POST',
      url: `/agents/${agent.id}/skills`,
      payload: { skill_ids: [s1.id] },
    });
    expect(reordered.json()).toHaveLength(1);
    expect(reordered.json()[0].skill_id).toBe(s1.id);

    await app.close();
  });

  it('rejects a cross-workspace skill id before writing any links', async () => {
    const app = await appWith();
    const agent = await createAgent(app, 'Cross WS Agent');
    const ownSkill = await createSkill(app, 'Own Skill', 'own body');

    // A skill that lives in a DIFFERENT workspace.
    const [otherWs] = await pg.handle.db.insert(t.workspaces).values({ name: 'other-ws' }).returning();
    const [foreignSkill] = await pg.handle.db
      .insert(t.skills)
      .values({
        workspaceId: otherWs!.id,
        name: 'Foreign Skill',
        description: 'x',
        type: 'rubric',
        source: 'manual',
        body: 'foreign body',
        enabled: true,
        version: 1,
      })
      .returning();

    const res = await app.inject({
      method: 'POST',
      url: `/agents/${agent.id}/skills`,
      payload: { skill_ids: [ownSkill.id, foreignSkill!.id] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('invalid_skill_ids');

    // No links were written (rejected before the transaction).
    const links = (await app.inject({ method: 'GET', url: `/agents/${agent.id}/skills` })).json();
    expect(links).toHaveLength(0);

    await app.close();
  });

  it('promptSkillBodiesForAgent: global-enable filter, in link order', async () => {
    const app = await appWith();
    const agent = await createAgent(app, 'Filter Agent');
    const enabledA = await createSkill(app, 'Enabled A', 'BODY_ENABLED_A', true);
    const disabled = await createSkill(app, 'Disabled', 'BODY_DISABLED', false);
    const enabledB = await createSkill(app, 'Enabled B', 'BODY_ENABLED_B', true);

    // Link all three, disabled one in the middle — order must be preserved,
    // filtering only drops the disabled one.
    await app.inject({
      method: 'POST',
      url: `/agents/${agent.id}/skills`,
      payload: { skill_ids: [enabledA.id, disabled.id, enabledB.id] },
    });

    const repo = new AgentsRepository(pg.handle.db);
    const bodies = await repo.promptSkillBodiesForAgent(agent.id);
    expect(bodies).toEqual(['BODY_ENABLED_A', 'BODY_ENABLED_B']);

    // No active linked skills (unlink everything) → empty array.
    await app.inject({
      method: 'POST',
      url: `/agents/${agent.id}/skills`,
      payload: { skill_ids: [] },
    });
    expect(await repo.promptSkillBodiesForAgent(agent.id)).toEqual([]);

    await app.close();
  });

  async function setupRepoAndPr(db: PgFixture['handle']['db']) {
    const [repo] = await db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name: `skills-inj-${Date.now()}`, fullName: `acme/skills-inj-${Date.now()}` })
      .returning();
    const [pr] = await db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId: repo!.id,
        number: 501,
        title: 'Add rate limiting',
        author: 'marisa.koch',
        branch: 'feat/rl',
        base: 'main',
        headSha: 'a1b2c3d4',
        additions: 1,
        deletions: 0,
        filesCount: 1,
        status: 'needs_review',
      })
      .returning();
    await db.insert(t.prFiles).values({
      prId: pr!.id,
      path: 'src/config.ts',
      additions: 1,
      deletions: 0,
      patch: '@@ -10,3 +10,4 @@\n   port: 3000,\n+  stripeKey: "sk_live_xxx",\n   redisUrl: x,',
    });
    return { repo: repo!, pr: pr! };
  }

  it('a run with 2 linked+enabled skills and 1 linked+disabled skill injects only the 2 enabled bodies, in order', async () => {
    const app = await appWith();
    const { pr } = await setupRepoAndPr(pg.handle.db);
    const agent = await createAgent(app, 'Injection Agent');
    const skillA = await createSkill(app, 'Rubric A', '## Rubric A\nCheck X.', true);
    const skillDisabled = await createSkill(app, 'Rubric Off', '## Rubric Off\nCheck Y.', false);
    const skillB = await createSkill(app, 'Rubric B', '## Rubric B\nCheck Z.', true);
    await app.inject({
      method: 'POST',
      url: `/agents/${agent.id}/skills`,
      payload: { skill_ids: [skillA.id, skillDisabled.id, skillB.id] },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/pulls/${pr.id}/review`,
      payload: { agentId: agent.id },
    });
    expect(res.statusCode).toBe(200);
    await waitForPrRuns(pg.handle.db, pr.id, { expected: 1 });

    const runId = res.json().runs[0].run_id;
    const trace = (await app.inject({ method: 'GET', url: `/runs/${runId}/trace` })).json();

    expect(trace.prompt_assembly.skills).toContain('Check X.');
    expect(trace.prompt_assembly.skills).toContain('Check Z.');
    expect(trace.prompt_assembly.skills).not.toContain('Check Y.');
    // Order preserved: A before B.
    expect(trace.prompt_assembly.skills.indexOf('Check X.')).toBeLessThan(
      trace.prompt_assembly.skills.indexOf('Check Z.'),
    );
    expect(trace.log.some((l: { msg: string }) => l.msg.includes('Injecting 2 linked skill block'))).toBe(
      true,
    );

    await app.close();
  });

  it('a run with zero active linked skills has no Skills block and no injection log line', async () => {
    const app = await appWith();
    const { pr } = await setupRepoAndPr(pg.handle.db);
    const agent = await createAgent(app, 'No Skills Agent');

    const res = await app.inject({
      method: 'POST',
      url: `/pulls/${pr.id}/review`,
      payload: { agentId: agent.id },
    });
    await waitForPrRuns(pg.handle.db, pr.id, { expected: 1 });

    const runId = res.json().runs[0].run_id;
    const trace = (await app.inject({ method: 'GET', url: `/runs/${runId}/trace` })).json();

    expect(trace.prompt_assembly.skills).toBeFalsy();
    expect(trace.log.some((l: { msg: string }) => l.msg.includes('Injecting'))).toBe(false);

    await app.close();
  });
});
