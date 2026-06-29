/* FindingsHint — shared severity-count display + hover popover listing the
   actual findings. Used by the PR-list FINDINGS column (counts as trigger) and
   the PR-detail timeline (status badge as trigger, popover content reused). */
"use client";

import React from "react";
import {
  Icon,
  SeverityBadge,
  CategoryTag,
  MonoLink,
  ConfidenceNum,
  SEV,
  type Severity,
  type Category,
} from "@devdigest/ui";
import type { Finding } from "@devdigest/shared";
import { githubBlobUrl } from "@/lib/github-urls";
import { HoverCard } from "@/components/HoverCard";

/** Severities in worst-first display order. */
const ORDER: Severity[] = ["CRITICAL", "WARNING", "SUGGESTION"];

function lineLabel(f: Pick<Finding, "start_line" | "end_line">): string {
  return f.start_line === f.end_line ? `${f.start_line}` : `${f.start_line}–${f.end_line}`;
}

function tally(findings: Finding[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const f of findings) c[f.severity] = (c[f.severity] ?? 0) + 1;
  return c;
}

/** Inline per-severity icon + count (the always-visible trigger). */
export function SeverityCounts({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) {
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  }
  const counts = tally(findings);
  const present = ORDER.filter((sev) => (counts[sev] ?? 0) > 0);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {present.map((sev) => {
        const I = Icon[SEV[sev].icon];
        return (
          <span
            key={sev}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, color: SEV[sev].c }}
            title={`${counts[sev]} ${SEV[sev].label.toLowerCase()}`}
          >
            <I size={13} />
            <span className="tnum" style={{ fontSize: 12.5, fontWeight: 600 }}>
              {counts[sev]}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Popover body: "N findings" header + a compact, scrollable finding list. */
export function FindingsHintContent({
  findings,
  repoFullName,
  headSha,
}: {
  findings: Finding[];
  repoFullName?: string | null;
  headSha?: string | null;
}) {
  if (findings.length === 0) return null;
  const counts = tally(findings);
  const summary = ORDER.filter((s) => (counts[s] ?? 0) > 0)
    .map((s) => `${counts[s]} ${SEV[s].label.toLowerCase()}`)
    .join(" · ");
  // Worst-first so the most important findings are at the top of the popover.
  const sorted = [...findings].sort(
    (a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity),
  );
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          {findings.length} {findings.length === 1 ? "finding" : "findings"}
        </span>
        <span style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{summary}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
        {sorted.map((f) => {
          const href =
            repoFullName && headSha
              ? githubBlobUrl(repoFullName, headSha, f.file, f.start_line, f.end_line)
              : undefined;
          return (
            <div key={f.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <SeverityBadge severity={f.severity as Severity} compact />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{f.title}</span>
                <CategoryTag category={f.category as Category} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <MonoLink href={href}>
                  {f.file}:{lineLabel(f)}
                </MonoLink>
                <ConfidenceNum value={f.confidence} />
              </div>
              {f.rationale && (
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {f.rationale}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** PR-list cell: severity counts that reveal the finding list on hover. */
export function FindingsHint({
  findings,
  repoFullName,
  headSha,
  align = "left",
}: {
  findings: Finding[];
  repoFullName?: string | null;
  headSha?: string | null;
  align?: "left" | "right";
}) {
  // No findings → just the em-dash, no (empty) popover on hover.
  if (findings.length === 0) return <SeverityCounts findings={findings} />;
  return (
    <HoverCard
      align={align}
      content={
        <FindingsHintContent findings={findings} repoFullName={repoFullName} headSha={headSha} />
      }
    >
      <SeverityCounts findings={findings} />
    </HoverCard>
  );
}
