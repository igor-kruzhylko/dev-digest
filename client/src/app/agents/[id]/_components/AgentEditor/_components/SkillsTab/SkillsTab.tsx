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
 * workspace skills (checkbox = linked) with drag-and-drop reordering (via a
 * grip handle) for the attached ones. Every check/uncheck/reorder persists
 * immediately via POST /agents/:id/skills (skill_ids full-set replace),
 * mirroring the enabled-toggle's instant-persist convention elsewhere in
 * this app.
 */
export function SkillsTab({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");
  const tSkills = useTranslations("skills");
  const [search, setSearch] = React.useState("");
  const [draggedId, setDraggedId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);

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

  const reorder = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const from = linkedOrder.indexOf(fromId);
    const to = linkedOrder.indexOf(toId);
    if (from === -1 || to === -1) return;
    const next = [...linkedOrder];
    next.splice(from, 1);
    next.splice(to, 0, fromId);
    persist(next);
  };

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.count}>
          {t("skills.enabledCount", { linked: linkedOrder.length, total: allSkills.length })}
        </span>
        {allSkills.length > 0 && (
          <div style={s.filterWrap}>
            <TextInput value={search} onChange={setSearch} placeholder={t("skills.filterPlaceholder")} />
          </div>
        )}
      </div>
      <p style={s.hint}>{t("skills.orderHint")}</p>

      {allSkills.length === 0 ? (
        <div style={s.empty}>{t("skills.empty")}</div>
      ) : rows.length === 0 ? (
        <div style={s.empty}>{t("skills.noMatch")}</div>
      ) : (
        <div style={s.list}>
          {rows.map((skillId, i) => {
            const skill = byId.get(skillId);
            if (!skill) return null;
            const attached = linkedOrder.includes(skillId);
            const prevId = rows[i - 1];
            const groupGap = i > 0 && !!prevId && linkedOrder.includes(prevId) && !attached;
            return (
              <div
                key={skillId}
                data-skill-row={skillId}
                style={{
                  ...s.row,
                  ...(groupGap ? s.rowGroupGap : {}),
                  ...(draggedId === skillId ? s.rowDragging : {}),
                  ...(overId === skillId && draggedId && draggedId !== skillId ? s.rowDragOver : {}),
                }}
                onDragOver={
                  attached
                    ? (e) => {
                        if (!draggedId) return;
                        e.preventDefault();
                        setOverId(skillId);
                      }
                    : undefined
                }
                onDragLeave={attached ? () => setOverId((id) => (id === skillId ? null : id)) : undefined}
                onDrop={
                  attached
                    ? (e) => {
                        e.preventDefault();
                        if (draggedId) reorder(draggedId, skillId);
                        setDraggedId(null);
                        setOverId(null);
                      }
                    : undefined
                }
              >
                <div style={s.rowLeft}>
                  <div style={s.handleSlot}>
                    {attached && (
                      <button
                        type="button"
                        aria-label={t("skills.dragHandle")}
                        style={s.dragHandle}
                        draggable={!setSkills.isPending}
                        onDragStart={(e) => {
                          setDraggedId(skillId);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", skillId);
                          // Drag the whole row as the drag image, not just this handle button.
                          const row = (e.currentTarget as HTMLElement).closest<HTMLElement>("[data-skill-row]");
                          if (row && typeof e.dataTransfer.setDragImage === "function") {
                            const rect = row.getBoundingClientRect();
                            e.dataTransfer.setDragImage(row, e.clientX - rect.left, e.clientY - rect.top);
                          }
                        }}
                        onDragEnd={() => {
                          setDraggedId(null);
                          setOverId(null);
                        }}
                      >
                        <Icon.GripVertical size={14} />
                      </button>
                    )}
                  </div>
                  <Checkbox
                    checked={attached}
                    onChange={(v) => toggle(skillId, v)}
                    label={<span className="mono">{skill.name}</span>}
                  />
                </div>
                <div style={s.rowRight}>
                  <Badge color="var(--text-secondary)">{tSkills(`listItem.type.${skill.type}`)}</Badge>
                  {!skill.enabled && <Badge color="var(--text-muted)">{tSkills("preview.disabled")}</Badge>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
