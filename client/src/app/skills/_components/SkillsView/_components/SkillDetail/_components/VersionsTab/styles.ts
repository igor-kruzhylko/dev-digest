import type { CSSProperties } from "react";

/** Co-located styles for VersionsTab. */
export const s = {
  caption: { fontSize: 12, color: "var(--text-muted)", marginBottom: 16, maxWidth: 640 } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 10 } satisfies CSSProperties,
  row: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
  versionChip: { fontSize: 13, fontWeight: 700 } satisfies CSSProperties,
  label: { fontSize: 13, color: "var(--text-secondary)", flex: 1 } satisfies CSSProperties,
  date: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  actions: { display: "flex", gap: 8 } satisfies CSSProperties,
  diffBox: {
    marginTop: 8,
    borderRadius: 6,
    overflow: "hidden",
    border: "1px solid var(--border)",
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 12,
  } satisfies CSSProperties,
  diffLine: (kind: "added" | "removed" | "unchanged"): CSSProperties => ({
    padding: "2px 10px",
    whiteSpace: "pre-wrap",
    borderLeft: "3px solid " + (kind === "added" ? "var(--ok)" : kind === "removed" ? "var(--crit)" : "transparent"),
    background: kind === "added" ? "var(--ok-bg)" : kind === "removed" ? "var(--crit-bg)" : "var(--bg-primary)",
    color: "var(--text-primary)",
  }),
} as const;
