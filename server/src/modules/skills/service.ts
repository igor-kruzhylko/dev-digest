import type { Container } from '../../platform/container.js';
import type {
  CreateSkillInput,
  ImportSkillInput,
  Skill,
  SkillImportPreview,
  SkillUsage,
  SkillVersion,
  UpdateSkillInput,
} from '@devdigest/shared';
import { SkillsRepository } from './repository.js';
import { toSkillDto, toSkillVersionDto } from './helpers.js';
import { previewImport } from './import.js';

/**
 * A1 — skills service. Business logic for the Skills library page: CRUD,
 * versioning, usage, and import preview (delegates to import.ts, no DB write).
 */

export class SkillsService {
  private repo: SkillsRepository;

  constructor(private container: Container) {
    this.repo = container.skillsRepo;
  }

  async list(workspaceId: string): Promise<Skill[]> {
    const rows = await this.repo.list(workspaceId);
    return rows.map(toSkillDto);
  }

  async get(workspaceId: string, id: string): Promise<Skill | undefined> {
    const row = await this.repo.getById(workspaceId, id);
    return row ? toSkillDto(row) : undefined;
  }

  async create(workspaceId: string, input: CreateSkillInput): Promise<Skill> {
    const row = await this.repo.insert({
      workspaceId,
      name: input.name,
      description: input.description,
      type: input.type,
      body: input.body,
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.version_label !== undefined ? { versionLabel: input.version_label } : {}),
    });
    return toSkillDto(row);
  }

  async update(
    workspaceId: string,
    id: string,
    patch: UpdateSkillInput,
  ): Promise<Skill | undefined> {
    const row = await this.repo.update(workspaceId, id, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      ...(patch.body !== undefined ? { body: patch.body } : {}),
      ...(patch.source !== undefined ? { source: patch.source } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      ...(patch.version_label !== undefined ? { versionLabel: patch.version_label } : {}),
    });
    return row ? toSkillDto(row) : undefined;
  }

  /** Delete a skill. A `skill_in_use` AppError from the repository (409, when
   *  still linked to agents) propagates unhandled to the route/error handler. */
  async delete(workspaceId: string, id: string): Promise<boolean> {
    return this.repo.deleteById(workspaceId, id);
  }

  /**
   * Version history for a skill, newest version first. Workspace-scoped:
   * returns undefined when the skill isn't in this workspace (route -> 404).
   */
  async listVersions(workspaceId: string, id: string): Promise<SkillVersion[] | undefined> {
    const skill = await this.repo.getById(workspaceId, id);
    if (!skill) return undefined;
    const rows = await this.repo.listVersions(id);
    return rows.map(toSkillVersionDto);
  }

  /** Agents linking a single skill, workspace-scoped; undefined if the skill
   *  isn't in this workspace (route -> 404). */
  async usage(workspaceId: string, id: string): Promise<SkillUsage | undefined> {
    const skill = await this.repo.getById(workspaceId, id);
    if (!skill) return undefined;
    const agents = await this.repo.usage(workspaceId, id);
    return {
      skill_id: id,
      agent_count: agents.length,
      agents: agents.map((a) => ({ id: a.agentId, name: a.agentName })),
    };
  }

  /** Usage counts for every skill in the workspace — powers the list cards. */
  async usageAll(workspaceId: string): Promise<SkillUsage[]> {
    const [skills, counts] = await Promise.all([
      this.repo.list(workspaceId),
      this.repo.usageAll(workspaceId),
    ]);
    const countBySkillId = new Map(counts.map((c) => [c.skillId, c.agentCount]));
    return skills.map((skill) => ({
      skill_id: skill.id,
      agent_count: countBySkillId.get(skill.id) ?? 0,
      agents: [],
    }));
  }

  /** Preview an import — pure, no DB write. */
  previewImport(input: ImportSkillInput): SkillImportPreview {
    return previewImport(input);
  }
}
