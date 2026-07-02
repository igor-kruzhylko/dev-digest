import type { SkillType } from "@devdigest/shared";

/** Selectable skill types in the create modal. */
export const TYPE_OPTIONS: readonly SkillType[] = ["rubric", "convention", "security", "custom"];

export const DEFAULT_TYPE: SkillType = "rubric";

export const MODAL_WIDTH = 560;
