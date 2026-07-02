import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient } from '../src/adapters/mocks.js';
import { AgentsRepository } from '../src/modules/agents/repository.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[skills] Docker not available — skipping integration tests.');
}

/**
 * Skills module CRUD + versioning + usage + delete-guard — the DB-backed half
 * of Phase 1 (server/src/modules/skills). Mirrors agents-versions.it.test.ts's
 * structure (dockerAvailable gate, startPg, seed, buildApp, app.inject).
 */
d('skills module', () => {
  let pg: PgFixture;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function makeApp() {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    return buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
  }

  const createBody = {
    name: 'PR Quality Rubric',
    description: 'Rate PRs against a quality rubric.',
    type: 'rubric' as const,
    body: 'Evaluate the PR against these dimensions...',
  };

  it('CRUD round-trip: create, get, list, update, delete', async () => {
    const app = await makeApp();

    const created = await app.inject({ method: 'POST', url: '/skills', payload: createBody });
    expect(created.statusCode).toBe(201);
    const skill = created.json();
    expect(skill).toMatchObject({
      name: createBody.name,
      description: createBody.description,
      type: 'rubric',
      source: 'manual',
      enabled: true,
      version: 1,
    });
    const skillId = skill.id as string;

    const got = await app.inject({ method: 'GET', url: `/skills/${skillId}` });
    expect(got.statusCode).toBe(200);
    expect(got.json().id).toBe(skillId);

    const list = await app.inject({ method: 'GET', url: '/skills' });
    expect(list.statusCode).toBe(200);
    expect((list.json() as Array<{ id: string }>).some((s) => s.id === skillId)).toBe(true);

    const updated = await app.inject({
      method: 'PUT',
      url: `/skills/${skillId}`,
      payload: { description: 'Updated description.' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().description).toBe('Updated description.');
    expect(updated.json().version).toBe(1); // metadata-only edit does not bump

    const deleted = await app.inject({ method: 'DELETE', url: `/skills/${skillId}` });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json()).toEqual({ ok: true });

    const afterDelete = await app.inject({ method: 'GET', url: `/skills/${skillId}` });
    expect(afterDelete.statusCode).toBe(404);

    await app.close();
  });

  it('a new skill has exactly one version (v1) capturing its body', async () => {
    const app = await makeApp();
    const created = await app.inject({ method: 'POST', url: '/skills', payload: createBody });
    const skillId = created.json().id as string;

    const res = await app.inject({ method: 'GET', url: `/skills/${skillId}/versions` });
    expect(res.statusCode).toBe(200);
    const versions = res.json();
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({
      skill_id: skillId,
      version: 1,
      body: createBody.body,
      label: null,
    });
    expect(typeof versions[0].created_at).toBe('string');
    await app.close();
  });

  it('a body-changing PUT bumps version and appends a skill_versions row (newest first)', async () => {
    const app = await makeApp();
    const created = await app.inject({ method: 'POST', url: '/skills', payload: createBody });
    const skillId = created.json().id as string;

    const updated = await app.inject({
      method: 'PUT',
      url: `/skills/${skillId}`,
      payload: { body: 'A revised rubric body.', version_label: 'Added Tests dimension' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().version).toBe(2);

    const versions = (
      await app.inject({ method: 'GET', url: `/skills/${skillId}/versions` })
    ).json();
    expect(versions).toHaveLength(2);
    expect(versions.map((v: { version: number }) => v.version)).toEqual([2, 1]);
    expect(versions[0]).toMatchObject({
      version: 2,
      body: 'A revised rubric body.',
      label: 'Added Tests dimension',
    });
    expect(versions[1]).toMatchObject({ version: 1, body: createBody.body });
    await app.close();
  });

  it('a metadata-only PUT (enabled) does NOT bump the version', async () => {
    const app = await makeApp();
    const created = await app.inject({ method: 'POST', url: '/skills', payload: createBody });
    const skillId = created.json().id as string;

    const updated = await app.inject({
      method: 'PUT',
      url: `/skills/${skillId}`,
      payload: { enabled: false },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().version).toBe(1);
    expect(updated.json().enabled).toBe(false);

    const versions = (
      await app.inject({ method: 'GET', url: `/skills/${skillId}/versions` })
    ).json();
    expect(versions).toHaveLength(1);
    await app.close();
  });

  it('DELETE on an unlinked skill succeeds', async () => {
    const app = await makeApp();
    const created = await app.inject({ method: 'POST', url: '/skills', payload: createBody });
    const skillId = created.json().id as string;

    const deleted = await app.inject({ method: 'DELETE', url: `/skills/${skillId}` });
    expect(deleted.statusCode).toBe(200);
    await app.close();
  });

  it('DELETE on a skill linked to an agent returns 409 skill_in_use with agent details', async () => {
    const app = await makeApp();
    const { db } = pg.handle;

    const created = await app.inject({ method: 'POST', url: '/skills', payload: createBody });
    const skillId = created.json().id as string;

    const [{ id: workspaceId }] = await db
      .select({ id: t.workspaces.id })
      .from(t.workspaces)
      .where(eq(t.workspaces.name, 'default'));

    const agentsRepo = new AgentsRepository(db);
    const agent = await agentsRepo.insert({
      workspaceId: workspaceId!,
      name: 'Linked Agent',
      provider: 'openai',
      model: 'gpt-4o-mini',
      systemPrompt: 'Review the diff.',
    });
    await agentsRepo.setSkills(agent.id, [skillId]);

    const deleted = await app.inject({ method: 'DELETE', url: `/skills/${skillId}` });
    expect(deleted.statusCode).toBe(409);
    const body = deleted.json();
    expect(body.error.code).toBe('skill_in_use');
    expect(body.error.details.agents).toEqual(
      expect.arrayContaining([expect.objectContaining({ agentId: agent.id, agentName: 'Linked Agent' })]),
    );

    // Cleanup so this skill doesn't pollute other tests' /skills listing counts.
    await agentsRepo.setSkills(agent.id, []);
    await app.inject({ method: 'DELETE', url: `/skills/${skillId}` });
    await app.close();
  });

  it('GET /skills/:id/usage reflects real link counts', async () => {
    const app = await makeApp();
    const { db } = pg.handle;

    const created = await app.inject({ method: 'POST', url: '/skills', payload: createBody });
    const skillId = created.json().id as string;

    const noUsage = await app.inject({ method: 'GET', url: `/skills/${skillId}/usage` });
    expect(noUsage.statusCode).toBe(200);
    expect(noUsage.json()).toEqual({ skill_id: skillId, agent_count: 0, agents: [] });

    const [{ id: workspaceId }] = await db
      .select({ id: t.workspaces.id })
      .from(t.workspaces)
      .where(eq(t.workspaces.name, 'default'));
    const agentsRepo = new AgentsRepository(db);
    const agentA = await agentsRepo.insert({
      workspaceId: workspaceId!,
      name: 'Usage Agent A',
      provider: 'openai',
      model: 'gpt-4o-mini',
      systemPrompt: 'x',
    });
    const agentB = await agentsRepo.insert({
      workspaceId: workspaceId!,
      name: 'Usage Agent B',
      provider: 'openai',
      model: 'gpt-4o-mini',
      systemPrompt: 'x',
    });
    await agentsRepo.setSkills(agentA.id, [skillId]);
    await agentsRepo.setSkills(agentB.id, [skillId]);

    const usage = await app.inject({ method: 'GET', url: `/skills/${skillId}/usage` });
    expect(usage.statusCode).toBe(200);
    expect(usage.json().agent_count).toBe(2);
    expect(usage.json().agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: agentA.id, name: 'Usage Agent A' }),
        expect.objectContaining({ id: agentB.id, name: 'Usage Agent B' }),
      ]),
    );

    const usageAll = await app.inject({ method: 'GET', url: '/skills/usage' });
    expect(usageAll.statusCode).toBe(200);
    const usageAllEntry = (usageAll.json() as Array<{ skill_id: string; agent_count: number }>).find(
      (u) => u.skill_id === skillId,
    );
    expect(usageAllEntry?.agent_count).toBe(2);

    // Cleanup.
    await agentsRepo.setSkills(agentA.id, []);
    await agentsRepo.setSkills(agentB.id, []);
    await app.inject({ method: 'DELETE', url: `/skills/${skillId}` });
    await app.close();
  });

  it('404s for an unknown skill on get/update/delete/versions/usage', async () => {
    const app = await makeApp();
    const ghost = '00000000-0000-0000-0000-000000000000';

    expect((await app.inject({ method: 'GET', url: `/skills/${ghost}` })).statusCode).toBe(404);
    expect(
      (await app.inject({ method: 'PUT', url: `/skills/${ghost}`, payload: { enabled: false } }))
        .statusCode,
    ).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `/skills/${ghost}` })).statusCode).toBe(404);
    expect(
      (await app.inject({ method: 'GET', url: `/skills/${ghost}/versions` })).statusCode,
    ).toBe(404);
    expect((await app.inject({ method: 'GET', url: `/skills/${ghost}/usage` })).statusCode).toBe(
      404,
    );
    await app.close();
  });

  it('POST /skills/import/preview parses a markdown upload with NO DB write', async () => {
    const app = await makeApp();
    const text = ['---', 'name: Imported Skill', 'type: security', '---', 'Body text.'].join('\n');
    const contentBase64 = Buffer.from(text, 'utf-8').toString('base64');

    const before = await app.inject({ method: 'GET', url: '/skills' });
    const countBefore = (before.json() as unknown[]).length;

    const res = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: { filename: 'imported.md', content_base64: contentBase64 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      name: 'Imported Skill',
      type: 'security',
      body: 'Body text.',
      source: 'extracted',
    });

    const after = await app.inject({ method: 'GET', url: '/skills' });
    expect((after.json() as unknown[]).length).toBe(countBefore);
    await app.close();
  });
});
