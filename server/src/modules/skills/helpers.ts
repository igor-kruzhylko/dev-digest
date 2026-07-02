import type { Skill, SkillSource, SkillType, SkillVersion } from '@devdigest/shared';
// Row types come from the shared db/rows module (not ./repository) so this pure
// helper doesn't form an import cycle with its own data layer (mirrors
// agents/helpers.ts — see server/INSIGHTS.md 2026-06-25 "Codebase Patterns").
import type { SkillRow, SkillVersionRow } from '../../db/rows.js';

/**
 * Pure helpers for the skills module — DB row <-> DTO mapping and the
 * body-change-bumps-version rule. No I/O.
 */

/** Map a persisted skill row to the public `Skill` DTO. */
export function toSkillDto(row: SkillRow): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type as SkillType,
    source: row.source as SkillSource,
    body: row.body,
    enabled: row.enabled,
    version: row.version,
    evidence_files: row.evidenceFiles ?? null,
  };
}

/** Map a persisted `skill_versions` row to the public `SkillVersion` DTO. */
export function toSkillVersionDto(row: SkillVersionRow): SkillVersion {
  return {
    skill_id: row.skillId,
    version: row.version,
    body: row.body,
    label: row.label,
    created_at: row.createdAt.toISOString(),
  };
}

/**
 * True when a patch changes the skill's body relative to the existing row — a
 * body change bumps the version and snapshots `skill_versions`. Metadata-only
 * edits (name/description/type/enabled) do not bump (mirrors `isConfigChange`
 * in agents/helpers.ts).
 */
export function isBodyChange(
  existing: Pick<SkillRow, 'body'>,
  patch: { body?: string },
): boolean {
  return patch.body !== undefined && patch.body !== existing.body;
}
