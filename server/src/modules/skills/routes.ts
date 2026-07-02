import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { CreateSkillInput, ImportSkillInput, UpdateSkillInput } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import { SkillsService } from './service.js';

/**
 * A1 — skills module (owner A1). Owns `skills` + `skill_versions`; does NOT
 * touch `agent_skills` (that's the agents module's job, A2/Phase 2).
 *   GET    /skills                  → list (workspace-scoped)
 *   GET    /skills/usage            → usage counts for ALL workspace skills
 *   GET    /skills/:id              → one skill
 *   POST   /skills                  → create
 *   PUT    /skills/:id              → update (bumps version + snapshots on body change)
 *   DELETE /skills/:id              → delete (409 skill_in_use while linked)
 *   GET    /skills/:id/versions     → version history (newest first)
 *   GET    /skills/:id/usage        → agents linking this skill
 *   POST   /skills/import/preview   → parse a .md/.zip upload (NO DB write)
 */

export default async function skillsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new SkillsService(app.container);

  app.get('/skills', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId);
  });

  // Static-suffixed route registered before the `:id` param route (mirrors
  // agents/routes.ts ordering); fastify's router matches static segments
  // ahead of params regardless, but this keeps read order == match order.
  app.get('/skills/usage', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.usageAll(workspaceId);
  });

  app.post(
    '/skills/import/preview',
    { schema: { body: ImportSkillInput } },
    async (req, reply) => {
      await getContext(app.container, req);
      const preview = service.previewImport(req.body);
      reply.status(200);
      return preview;
    },
  );

  app.get('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.get(workspaceId, req.params.id);
    if (!skill) throw new NotFoundError('Skill not found');
    return skill;
  });

  app.post('/skills', { schema: { body: CreateSkillInput } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.create(workspaceId, req.body);
    reply.status(201);
    return skill;
  });

  app.put(
    '/skills/:id',
    { schema: { params: IdParams, body: UpdateSkillInput } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const skill = await service.update(workspaceId, req.params.id, req.body);
      if (!skill) throw new NotFoundError('Skill not found');
      return skill;
    },
  );

  app.delete('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const ok = await service.delete(workspaceId, req.params.id);
    if (!ok) throw new NotFoundError('Skill not found');
    return { ok: true };
  });

  app.get('/skills/:id/versions', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const versions = await service.listVersions(workspaceId, req.params.id);
    if (!versions) throw new NotFoundError('Skill not found');
    return versions;
  });

  app.get('/skills/:id/usage', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const usage = await service.usage(workspaceId, req.params.id);
    if (!usage) throw new NotFoundError('Skill not found');
    return usage;
  });
}
