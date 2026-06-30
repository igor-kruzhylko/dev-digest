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
  return f.start_line === f.end_line ? `${f.start_line}` : `${f.start_line}-${f.end_line}`;
}

function tally(findings: Finding[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const f of findings) c[f.severity] = (c[f.severity] ?? 0) + 1;
  return c;
}

/** Inline per-severity icon + count (the always-visible trigger). */
export function SeverityCounts({
  findings,
  activeSeverity = null,
  onSeverityClick,
}: {
  findings: Finding[];
  activeSeverity?: Severity | null;
  onSeverityClick?: (severity: Severity) => void;
}) {
  if (findings.length === 0) {
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  }

  const counts = tally(findings);
  const present = ORDER.filter((sev) => (counts[sev] ?? 0) > 0);
  const interactive = !!onSeverityClick;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {present.map((sev) => {
        const I = Icon[SEV[sev].icon];
        const active = activeSeverity === sev;
        const label = `${counts[sev]} ${SEV[sev].label.toLowerCase()}`;
        const content = (
          <>
            <I size={13} />
            <span className="tnum" style={{ fontSize: 12.5, fontWeight: 600 }}>
              {counts[sev]}
            </span>
          </>
        );

        if (!interactive) {
          return (
            <span
              key={sev}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, color: SEV[sev].c }}
              title={label}
            >
              {content}
            </span>
          );
        }

        return (
          <button
            key={sev}
            type="button"
            title={label}
            aria-pressed={active}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSeverityClick?.(sev);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              color: SEV[sev].c,
              border: `1px solid ${active ? SEV[sev].c : "transparent"}`,
              background: active ? "var(--bg-hover)" : "transparent",
              borderRadius: 5,
              padding: "1px 3px",
              margin: "-1px -3px",
              cursor: "pointer",
              font: "inherit",
            }}
          >
            {content}
          </button>
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
        <span style={{ fontSize: 11.5, color: "var(--text-secondary)", textAlign: "right", overflowWrap: "anywhere" }}>{summary}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflowY: "auto", overflowX: "hidden", paddingRight: 2 }}>
        {sorted.map((f) => {
          const href =
            repoFullName && headSha
              ? githubBlobUrl(repoFullName, headSha, f.file, f.start_line, f.end_line)
              : undefined;
          return (
            <div key={f.id} style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <SeverityBadge severity={f.severity as Severity} compact />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.35, overflowWrap: "anywhere" }}>{f.title}</span>
                <CategoryTag category={f.category as Category} />
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, flexDirection: "column", minWidth: 0 }}>
                <span style={{ maxWidth: "100%", overflowWrap: "anywhere", wordBreak: "break-word", whiteSpace: "normal" }}>
                  <MonoLink href={href}>
                    {f.file}:{lineLabel(f)}
                  </MonoLink>
                </span>
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
                    overflowWrap: "anywhere",
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

/** PR-list cell: severity counts that reveal the finding list on hover/click. */
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
  const [open, setOpen] = React.useState(false);
  const [severityFilter, setSeverityFilter] = React.useState<Severity | null>(null);

  React.useEffect(() => {
    if (severityFilter && !findings.some((f) => f.severity === severityFilter)) {
      setSeverityFilter(null);
    }
  }, [findings, severityFilter]);

  // No findings -> just the em-dash, no (empty) popover on hover.
  if (findings.length === 0) return <SeverityCounts findings={findings} />;

  const filteredFindings = severityFilter
    ? findings.filter((f) => f.severity === severityFilter)
    : findings;

  return (
    <HoverCard
      align={align}
      open={open}
      onOpenChange={setOpen}
      onClose={() => setSeverityFilter(null)}
      content={
        <FindingsHintContent
          findings={filteredFindings}
          repoFullName={repoFullName}
          headSha={headSha}
        />
      }
    >
      <SeverityCounts
        findings={findings}
        activeSeverity={severityFilter}
        onSeverityClick={(severity) => {
          setSeverityFilter((current) => (current === severity ? null : severity));
          setOpen(true);
        }}
      />
    </HoverCard>
  );
}

