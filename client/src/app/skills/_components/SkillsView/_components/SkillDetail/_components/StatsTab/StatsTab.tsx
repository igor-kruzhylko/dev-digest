"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Skeleton } from "@devdigest/ui";
import { useSkillUsage } from "@/lib/hooks/skills";
import { UNTRACKED_CARD_KEYS } from "./constants";
import { s } from "./styles";

/** Stats tab — USED BY + agents-using are REAL (from useSkillUsage). Pull
    frequency / accept rate / findings / cost have no data source and render
    "not tracked yet" — never a fabricated number (spec §7.2 / §14). */
export function StatsTab({ skillId }: { skillId: string }) {
  const t = useTranslations("skills");
  const { data: usage, isLoading } = useSkillUsage(skillId);

  if (isLoading || !usage) {
    return (
      <div style={s.grid}>
        <Skeleton height={90} />
        <Skeleton height={90} />
      </div>
    );
  }

  return (
    <div style={s.grid}>
      <div style={s.card}>
        <div style={s.cardLabel}>{t("stats.usedBy")}</div>
        <div style={s.cardValue}>{usage.agent_count}</div>
      </div>
      <div style={s.card}>
        <div style={s.cardLabel}>{t("stats.agentsUsing")}</div>
        {usage.agents.length === 0 ? (
          <div style={s.noAgents}>{t("stats.noAgents")}</div>
        ) : (
          <div style={s.agentList}>
            {usage.agents.map((a) => (
              <Link key={a.id} href={`/agents/${a.id}`} style={s.agentLink}>
                {a.name}
              </Link>
            ))}
          </div>
        )}
      </div>
      {UNTRACKED_CARD_KEYS.map((key) => (
        <div style={s.card} key={key}>
          <div style={s.cardLabel}>{t(`stats.${key}`)}</div>
          <div style={s.cardValueMuted}>{t("stats.notTracked")}</div>
        </div>
      ))}
    </div>
  );
}
