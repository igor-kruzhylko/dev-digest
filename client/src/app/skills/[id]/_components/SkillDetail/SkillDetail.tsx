/* SkillDetail — right pane of the /skills/:id editor. Self-contained: header
   (name + type badge + version badge + disabled "Run on evals" placeholder)
   + Tabs (Config/Preview/Evals/Stats/Versions), tab state in ?tab=. */
"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, Button, ErrorState, Icon, Skeleton, Tabs } from "@devdigest/ui";
import { useSkill } from "@/lib/hooks/skills";
import { ApiError } from "@/lib/api";
import { ConfigTab } from "./_components/ConfigTab";
import { PreviewTab } from "./_components/PreviewTab";
import { EvalsTab } from "./_components/EvalsTab";
import { StatsTab } from "./_components/StatsTab";
import { VersionsTab } from "./_components/VersionsTab";
import { DEFAULT_TAB, TABS, VALID_TABS } from "./constants";
import { s } from "./styles";

export function SkillDetail({ skillId }: { skillId: string }) {
  const t = useTranslations("skills");
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data: skill, isLoading, isError, error, refetch } = useSkill(skillId);

  const tab = VALID_TABS.includes(search.get("tab") ?? "") ? search.get("tab")! : DEFAULT_TAB;
  const setTab = (tb: string) => {
    const sp = new URLSearchParams(search.toString());
    sp.set("tab", tb);
    router.replace(`${pathname}?${sp.toString()}`);
  };

  if (isError || (!isLoading && !skill)) {
    return (
      <ErrorState
        fullScreen
        title={t("detail.notFound.title")}
        body={error instanceof ApiError ? error.message : t("detail.notFound.body")}
        onRetry={() => refetch()}
      />
    );
  }

  if (isLoading || !skill) {
    return (
      <div style={s.loadingWrap}>
        <Skeleton height={24} width={240} />
        <Skeleton height={200} />
      </div>
    );
  }

  const tabs = TABS.map((tb) => ({ key: tb.key, label: t(tb.labelKey), icon: tb.icon }));

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <Icon.Sparkles size={18} style={{ color: "var(--accent)" }} />
        <h1 style={s.h1}>{skill.name}</h1>
        <Badge color="var(--text-secondary)">{t(`listItem.type.${skill.type}`)}</Badge>
        <Badge color="var(--text-secondary)" mono>
          {t("preview.version", { version: skill.version })}
        </Badge>
        <div style={{ marginLeft: "auto" }}>
          <Button kind="secondary" size="sm" icon="FlaskConical" disabled>
            {t("tabs.runOnEvals")}
          </Button>
        </div>
      </div>
      <div style={s.tabsBar}>
        <Tabs tabs={tabs} value={tab} onChange={setTab} pad="0 28px" />
      </div>
      <div style={s.body}>
        {tab === "config" && <ConfigTab skill={skill} />}
        {tab === "preview" && <PreviewTab skill={skill} />}
        {tab === "evals" && <EvalsTab />}
        {tab === "stats" && <StatsTab skillId={skill.id} />}
        {tab === "versions" && <VersionsTab skill={skill} />}
      </div>
    </div>
  );
}
