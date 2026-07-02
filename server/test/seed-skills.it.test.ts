import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { seed } from '../src/db/seed.js';
import { diffFromPrFiles } from '../src/modules/reviews/diff-loader.js';
import { ReviewRepository } from '../src/modules/reviews/repository.js';
import * as t from '../src/db/schema.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

/**
 * Phase 5 — the Skills-lesson seed: demo skills (with pr-quality-rubric's
 * version history), the two experiment agents, their skill links (seeded
 * default = WITH skills), and the two offline-reviewable demo PRs. Also
 * covers idempotency — `pnpm db:seed` must be safe to re-run.
 */
d('Skills-lesson seed (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;

  beforeAll(async () => {
    pg = await startPg();
    const result = await seed(pg.handle.db);
    workspaceId = result.workspaceId;
    // Re-run to prove idempotency — a second call must not duplicate rows or throw.
    await seed(pg.handle.db);
  });
  afterAll(async () => {
    await pg?.stop();
  });

  it('seeds exactly the 5 demo skills, all enabled, one extracted', async () => {
    const rows = await pg.handle.db
      .select()
      .from(t.skills)
      .where(eq(t.skills.workspaceId, workspaceId));
    const byName = new Map(rows.map((r) => [r.name, r]));

    expect(rows).toHaveLength(5);
    for (const r of rows) expect(r.enabled).toBe(true);

    expect(byName.get('test-quality-rubric')?.source).toBe('extracted');
    expect(byName.get('api-contract-gate')?.source).toBe('manual');
    expect(byName.get('pr-quality-rubric')?.version).toBe(5);
  });

  it('pr-quality-rubric has 5 version snapshots with labels, newest matching the current body', async () => {
    const [skill] = await pg.handle.db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.name, 'pr-quality-rubric')));
    const versions = await pg.handle.db
      .select()
      .from(t.skillVersions)
      .where(eq(t.skillVersions.skillId, skill!.id));

    expect(versions).toHaveLength(5);
    const labels = versions.sort((a, b) => a.version - b.version).map((v) => v.label);
    expect(labels).toEqual([
      'Initial rubric',
      'Added Tests dimension',
      'Added Docs dimension',
      'Tightened naming conventions',
      'Added Security cross-check',
    ]);
    const latest = versions.find((v) => v.version === 5)!;
    expect(latest.body).toBe(skill!.body);
  });

  it('seeds the two experiment agents, each linked to its skill (seeded default = with skills)', async () => {
    const agentRows = await pg.handle.db
      .select()
      .from(t.agents)
      .where(eq(t.agents.workspaceId, workspaceId));
    const testQualityAgent = agentRows.find((a) => a.name === 'Test Quality Reviewer');
    const apiContractAgent = agentRows.find((a) => a.name === 'API Contract Reviewer');
    expect(testQualityAgent).toBeDefined();
    expect(apiContractAgent).toBeDefined();
    expect(testQualityAgent!.enabled).toBe(true);
    expect(apiContractAgent!.enabled).toBe(true);

    const skillRows = await pg.handle.db
      .select()
      .from(t.skills)
      .where(eq(t.skills.workspaceId, workspaceId));
    const testQualitySkill = skillRows.find((s) => s.name === 'test-quality-rubric')!;
    const apiContractSkill = skillRows.find((s) => s.name === 'api-contract-gate')!;

    const links = await pg.handle.db.select().from(t.agentSkills);
    expect(
      links.some((l) => l.agentId === testQualityAgent!.id && l.skillId === testQualitySkill.id),
    ).toBe(true);
    expect(
      links.some((l) => l.agentId === apiContractAgent!.id && l.skillId === apiContractSkill.id),
    ).toBe(true);

    // No duplicate links after the idempotent re-seed in beforeAll.
    expect(links.filter((l) => l.agentId === testQualityAgent!.id)).toHaveLength(1);
    expect(links.filter((l) => l.agentId === apiContractAgent!.id)).toHaveLength(1);
  });

  it('seeds the two demo PRs (#501, #502) with patches that reconstruct into a real diff', async () => {
    const prs = await pg.handle.db
      .select()
      .from(t.pullRequests)
      .where(eq(t.pullRequests.workspaceId, workspaceId));
    const pr501 = prs.find((p) => p.number === 501);
    const pr502 = prs.find((p) => p.number === 502);
    expect(pr501).toBeDefined();
    expect(pr502).toBeDefined();

    const repo = new ReviewRepository(pg.handle.db);

    const diff501 = await diffFromPrFiles(repo, pr501!.id);
    expect(diff501.files.length).toBe(2);
    expect(diff501.files.map((f) => f.path).sort()).toEqual([
      'src/pricing/discount.test.ts',
      'src/pricing/discount.ts',
    ]);
    const discountFile = diff501.files.find((f) => f.path === 'src/pricing/discount.ts')!;
    expect(discountFile.hunks.length).toBeGreaterThan(0);
    expect(discountFile.additions).toBeGreaterThan(0);

    const diff502 = await diffFromPrFiles(repo, pr502!.id);
    expect(diff502.files.length).toBe(1);
    expect(diff502.files[0]!.path).toBe('src/api/pulls.ts');
    expect(diff502.files[0]!.deletions).toBeGreaterThan(0);
  });

  it('re-running seed does not duplicate PRs, agents, or skills', async () => {
    const skillCount = await pg.handle.db
      .select()
      .from(t.skills)
      .where(eq(t.skills.workspaceId, workspaceId));
    const prCount = await pg.handle.db
      .select()
      .from(t.pullRequests)
      .where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.number, 501)));
    expect(skillCount).toHaveLength(5);
    expect(prCount).toHaveLength(1);
  });
});
