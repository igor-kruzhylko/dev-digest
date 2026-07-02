"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Checkbox, ErrorState, Icon, Skeleton, TextInput } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useAgentSkills, useSetAgentSkills } from "@/lib/hooks/agents";
import { useSkills } from "@/lib/hooks/skills";
import { s } from "./styles";

/**
 * Skills tab — attach/detach + reorder the agent's linked skills. Lists ALL
 * workspace skills (checkbox = linked) with up/down reordering for the
 * attached ones. Every check/uncheck/reorder persists immediately via
 * POST /agents/:id/skills (skill_ids full-set replace), mirroring the
 * enabled-toggle's instant-persist convention elsewhere in this app.
 */
export function SkillsTab({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");
  const tSkills = useTranslations("skills");
  const [search, setSearch] = React.useState("");

  const { data: allSkills, isLoading: skillsLoading, isError, refetch } = useSkills();
  const { data: links, isLoading: linksLoading } = useAgentSkills(agent.id);
  const setSkills = useSetAgentSkills();

  if (isError) {
    return <ErrorState body={t("skills.loadError")} onRetry={() => refetch()} />;
  }
  if (skillsLoading || linksLoading || !allSkills || !links) {
    return (
      <div style={s.wrap}>
        <Skeleton height={40} style={{ marginBottom: 8 }} />
        <Skeleton height={40} style={{ marginBottom: 8 }} />
        <Skeleton height={40} />
      </div>
    );
  }

  const linkedOrder = [...links].sort((a, b) => a.order - b.order).map((l) => l.skill_id);
  const linkedSet = new Set(linkedOrder);
  const byId = new Map(allSkills.map((sk) => [sk.id, sk]));
  const unattached = allSkills.filter((sk) => !linkedSet.has(sk.id)).map((sk) => sk.id);

  const rows = [...linkedOrder, ...unattached].filter((id) => {
    if (!search.trim()) return true;
    const skill = byId.get(id);
    return skill?.name.toLowerCase().includes(search.trim().toLowerCase());
  });

  const persist = (nextOrder: string[]) => setSkills.mutate({ agentId: agent.id, skillIds: nextOrder });

  const toggle = (skillId: string, checked: boolean) => {
    persist(checked ? [...linkedOrder, skillId] : linkedOrder.filter((id) => id !== skillId));
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= linkedOrder.length) return;
    const next = [...linkedOrder];
    [next[index], next[target]] = [next[target]!, next[index]!];
    persist(next);
  };

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("skills.title")}</h2>
        <span style={s.count}>
          {t("skills.enabledCount", { linked: linkedOrder.length, total: allSkills.length })}
        </span>
      </div>
      <p style={s.hint}>{t("skills.orderHint")}</p>
      {allSkills.length > 0 && (
        <TextInput value={search} onChange={setSearch} placeholder={t("skills.filterPlaceholder")} />
      )}

      {allSkills.length === 0 ? (
        <div style={s.empty}>{t("skills.empty")}</div>
      ) : rows.length === 0 ? (
        <div style={s.empty}>{t("skills.noMatch")}</div>
      ) : (
        <div style={s.list}>
          {rows.map((skillId) => {
            const skill = byId.get(skillId);
            if (!skill) return null;
            const attachedIndex = linkedOrder.indexOf(skillId);
            const attached = attachedIndex !== -1;
            return (
              <div key={skillId} style={s.row}>
                <Checkbox
                  checked={attached}
                  onChange={(v) => toggle(skillId, v)}
                  label={
                    <span style={s.rowLabel}>
                      <span className="mono">{skill.name}</span>
                      <Badge color="var(--text-secondary)">{tSkills(`listItem.type.${skill.type}`)}</Badge>
                      {!skill.enabled && <Badge color="var(--text-muted)">{tSkills("preview.disabled")}</Badge>}
                    </span>
                  }
                />
                {attached && (
                  <div style={s.reorder}>
                    <button
                      type="button"
                      aria-label="Move up"
                      style={s.reorderBtn}
                      disabled={attachedIndex === 0 || setSkills.isPending}
                      onClick={() => move(attachedIndex, -1)}
                    >
                      <Icon.ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      style={s.reorderBtn}
                      disabled={attachedIndex === linkedOrder.length - 1 || setSkills.isPending}
                      onClick={() => move(attachedIndex, 1)}
                    >
                      <Icon.ArrowDown size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
