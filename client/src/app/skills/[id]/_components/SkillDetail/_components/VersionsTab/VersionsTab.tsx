"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Skeleton } from "@devdigest/ui";
import type { Skill, SkillVersion } from "@devdigest/shared";
import { useSkillVersions, useUpdateSkill } from "@/lib/hooks/skills";
import { diffLines } from "./diff";
import { s } from "./styles";

/** Versions tab — newest-first list with Restore (re-PUTs the chosen body
    with a "Restored vN" label, bumping to a NEW version) and Diff (inline
    line diff against the next-newer version). */
export function VersionsTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const { data: versions, isLoading } = useSkillVersions(skill.id);
  const update = useUpdateSkill();
  const [diffOpenFor, setDiffOpenFor] = React.useState<number | null>(null);

  if (isLoading || !versions) {
    return (
      <div>
        <Skeleton height={60} style={{ marginBottom: 10 }} />
        <Skeleton height={60} style={{ marginBottom: 10 }} />
      </div>
    );
  }

  // Newest first (server already returns newest-first per spec; sort defensively).
  const sorted = [...versions].sort((a, b) => b.version - a.version);

  const restore = (v: SkillVersion) =>
    update.mutate({
      id: skill.id,
      patch: { body: v.body, version_label: `Restored v${v.version}` },
    });

  return (
    <div>
      <div style={s.caption}>{t("versions.snapshotNote")}</div>
      <div style={s.list}>
        {sorted.map((v, idx) => {
          const isCurrent = v.version === skill.version;
          // "Next-newer" version to diff against is the previous entry in the
          // newest-first list; the oldest (last) row has nothing newer to diff.
          const nextNewer = idx > 0 ? sorted[idx - 1] : null;
          const canDiff = nextNewer != null;
          const diffOpen = diffOpenFor === v.version;

          return (
            <div key={v.version}>
              <div style={s.row}>
                <span className="mono" style={s.versionChip}>
                  v{v.version}
                </span>
                {isCurrent && <Badge color="var(--accent)">{t("versions.current")}</Badge>}
                <span style={s.label}>{v.label ?? t("versions.noLabel")}</span>
                <span style={s.date}>{new Date(v.created_at).toLocaleDateString()}</span>
                <div style={s.actions}>
                  {canDiff && (
                    <Button
                      kind="ghost"
                      size="sm"
                      onClick={() => setDiffOpenFor(diffOpen ? null : v.version)}
                    >
                      {t("versions.diff")}
                    </Button>
                  )}
                  {!isCurrent && (
                    <Button
                      kind="secondary"
                      size="sm"
                      onClick={() => restore(v)}
                      disabled={update.isPending}
                    >
                      {update.isPending ? t("versions.restoring") : t("versions.restore")}
                    </Button>
                  )}
                </div>
              </div>
              {diffOpen && nextNewer && (
                <div style={s.diffBox}>
                  {diffLines(v.body, nextNewer.body).map((line, i) => (
                    <div key={i} style={s.diffLine(line.kind)}>
                      {line.text || " "}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
