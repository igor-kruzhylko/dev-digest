import type { CSSProperties } from "react";

/** Co-located styles for StatsTab. */
export const s = {
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 } satisfies CSSProperties,
  card: {
    padding: 16,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
  cardLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: 8,
  } satisfies CSSProperties,
  cardValue: { fontSize: 24, fontWeight: 700 } satisfies CSSProperties,
  cardValueMuted: { fontSize: 15, fontWeight: 500, color: "var(--text-muted)" } satisfies CSSProperties,
  agentList: { display: "flex", flexDirection: "column", gap: 6, marginTop: 4 } satisfies CSSProperties,
  agentLink: { fontSize: 13, color: "var(--accent-text)" } satisfies CSSProperties,
  noAgents: { fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
} as const;
