"use client";

import { useTranslations } from "next-intl";
import { Markdown } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { s } from "./styles";

/** Preview tab — renders the skill body as the reviewing agent receives it. */
export function PreviewTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  return (
    <div style={s.wrap}>
      <div style={s.caption}>{t("preview.caption")}</div>
      <div style={s.bodyBox}>
        <Markdown>{skill.body}</Markdown>
      </div>
    </div>
  );
}
