/* SkillsView — the ONE shared master-detail component rendered by both
   /skills and /skills/[id]. `selectedId` (null on /skills) drives whether
   the right pane shows the "select a skill" prompt or the SkillDetail tabs. */
"use client";

import { useTranslations } from "next-intl";
import { AppShell } from "@/components/app-shell";
import { SkillsList } from "./_components/SkillsList";
import { SkillDetail } from "./_components/SkillDetail";
import { s } from "./styles";

export function SkillsView({ selectedId }: { selectedId: string | null }) {
  const t = useTranslations("skills");

  return (
    <AppShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.crumbSkills") }]}>
      <div style={s.shell}>
        <div style={s.listCol}>
          <SkillsList selectedId={selectedId} />
        </div>
        <div style={s.detailCol}>
          {selectedId == null ? (
            <div style={s.selectPrompt}>
              <SelectPrompt />
            </div>
          ) : (
            <SkillDetail skillId={selectedId} />
          )}
        </div>
      </div>
    </AppShell>
  );
}

function SelectPrompt() {
  const t = useTranslations("skills");
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 8,
        padding: 28,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
        {t("page.selectPrompt.title")}
      </div>
      <div style={{ fontSize: 14, color: "var(--text-secondary)", maxWidth: 320, lineHeight: 1.5 }}>
        {t("page.selectPrompt.body")}
      </div>
    </div>
  );
}
