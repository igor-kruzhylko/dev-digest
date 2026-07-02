import { and, eq, desc } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { SkillSource, SkillType } from '@devdigest/shared';
import { AppError } from '../../platform/errors.js';
import { INITIAL_SKILL_VERSION } from './constants.js';
import { isBodyChange } from './helpers.js';

/**
 * A1 — skills data-access. Owns `skills` + `skill_versions` only. Does NOT
 * touch `agent_skills` (owned by AgentsRepository — the agent side of the
 * link table) or the agents module. Workspace-scoped throughout.
 */

import type { SkillRow, SkillVersionRow } from '../../db/rows.js';
export type { SkillRow, SkillVersionRow };

export interface InsertSkill {
  workspaceId: string;
  name: string;
  description: string;
  type: SkillType;
  body: string;
  source?: SkillSource;
  enabled?: boolean;
  versionLabel?: string;
}

export interface UpdateSkill {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
  source?: SkillSource;
  enabled?: boolean;
  versionLabel?: string;
}

/** One agent linking a skill (id + name), used by usage()/deleteById(). */
export interface UsageAgent {
  agentId: string;
  agentName: string;
}

/** Light-weight per-skill usage count, used by usageAll(). */
export interface SkillUsageCount {
  skillId: string;
  agentCount: number;
}

export class SkillsRepository {
  constructor(private db: Db) {}

  async list(workspaceId: string): Promise<SkillRow[]> {
    return this.db.select().from(t.skills).where(eq(t.skills.workspaceId, workspaceId));
  }

  async getById(workspaceId: string, id: string): Promise<SkillRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)));
    return row;
  }

  /** Insert a skill AND record version 1 in skill_versions (immutable snapshot). */
  async insert(values: InsertSkill): Promise<SkillRow> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(t.skills)
        .values({
          workspaceId: values.workspaceId,
          name: values.name,
          description: values.description,
          type: values.type,
          source: values.source ?? 'manual',
          body: values.body,
          enabled: values.enabled ?? true,
          version: INITIAL_SKILL_VERSION,
        })
        .returning();
      await tx
        .insert(t.skillVersions)
        .values({
          skillId: row!.id,
          version: INITIAL_SKILL_VERSION,
          body: row!.body,
          label: values.versionLabel ?? null,
        })
        .onConflictDoNothing();
      return row!;
    });
  }

  /**
   * Update a skill. A body change bumps the version and snapshots the new body
   * into skill_versions (reproducibility for eval). Metadata-only edits
   * (name/description/type/enabled) do not bump.
   */
  async update(
    workspaceId: string,
    id: string,
    patch: UpdateSkill,
  ): Promise<SkillRow | undefined> {
    const existing = await this.getById(workspaceId, id);
    if (!existing) return undefined;

    const bodyChanged = isBodyChange(existing, patch);
    const nextVersion = bodyChanged ? existing.version + 1 : existing.version;

    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(t.skills)
        .set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.type !== undefined ? { type: patch.type } : {}),
          ...(patch.source !== undefined ? { source: patch.source } : {}),
          ...(patch.body !== undefined ? { body: patch.body } : {}),
          ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
          ...(bodyChanged ? { version: nextVersion } : {}),
        })
        .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
        .returning();

      if (bodyChanged && row) {
        await tx
          .insert(t.skillVersions)
          .values({
            skillId: row.id,
            version: nextVersion,
            body: row.body,
            label: patch.versionLabel ?? null,
          })
          .onConflictDoNothing();
      }
      return row;
    });
  }

  /** All config snapshots for a skill, newest version first. */
  async listVersions(skillId: string): Promise<SkillVersionRow[]> {
    return this.db
      .select()
      .from(t.skillVersions)
      .where(eq(t.skillVersions.skillId, skillId))
      .orderBy(desc(t.skillVersions.version));
  }

  /** Agents (in this workspace) that link the given skill. */
  async usage(workspaceId: string, skillId: string): Promise<UsageAgent[]> {
    const rows = await this.db
      .select({ agentId: t.agents.id, agentName: t.agents.name })
      .from(t.agentSkills)
      .innerJoin(t.agents, eq(t.agentSkills.agentId, t.agents.id))
      .where(and(eq(t.agentSkills.skillId, skillId), eq(t.agents.workspaceId, workspaceId)));
    return rows;
  }

  /**
   * Usage counts for ALL of a workspace's skills — light payload (counts only,
   * not full agent lists) since this powers the list cards.
   */
  async usageAll(workspaceId: string): Promise<SkillUsageCount[]> {
    const rows = await this.db
      .select({ skillId: t.agentSkills.skillId, agentId: t.agents.id })
      .from(t.agentSkills)
      .innerJoin(t.agents, eq(t.agentSkills.agentId, t.agents.id))
      .where(eq(t.agents.workspaceId, workspaceId));

    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.skillId, (counts.get(row.skillId) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([skillId, agentCount]) => ({
      skillId,
      agentCount,
    }));
  }

  /**
   * Delete a skill (scoped to workspace). Blocked with `409 skill_in_use` while
   * any agent still links it — checked FIRST, not left to the FK cascade, since
   * that's user-visible behaviour, not just referential integrity. Returns false
   * if no such skill existed in the workspace.
   */
  async deleteById(workspaceId: string, id: string): Promise<boolean> {
    const existing = await this.getById(workspaceId, id);
    if (!existing) return false;

    const linkedAgents = await this.usage(workspaceId, id);
    if (linkedAgents.length > 0) {
      throw new AppError(
        'skill_in_use',
        `Skill is linked to ${linkedAgents.length} agent(s)`,
        409,
        { agents: linkedAgents.map((a) => ({ id: a.agentId, name: a.agentName })) },
      );
    }

    const rows = await this.db
      .delete(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
      .returning({ id: t.skills.id });
    return rows.length > 0;
  }
}
