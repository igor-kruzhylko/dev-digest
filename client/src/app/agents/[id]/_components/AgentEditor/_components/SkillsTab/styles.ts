import type { CSSProperties } from "react";

/** Co-located styles for SkillsTab. */
export const s = {
  wrap: { maxWidth: 760 } satisfies CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  } satisfies CSSProperties,
  count: { fontSize: 14, fontWeight: 600, color: "var(--text-primary)" } satisfies CSSProperties,
  filterWrap: { width: 200, flexShrink: 0 } satisfies CSSProperties,
  hint: { fontSize: 13, color: "var(--text-muted)", margin: "0 0 18px" } satisfies CSSProperties,
  empty: { padding: "24px 0", fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 2, marginTop: 14 } satisfies CSSProperties,
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    marginBottom: 6,
  } satisfies CSSProperties,
  rowGroupGap: { marginTop: 14 } satisfies CSSProperties,
  rowDragging: { opacity: 0.4 } satisfies CSSProperties,
  rowDragOver: {
    border: "1px solid var(--accent)",
    background: "var(--bg-hover)",
  } satisfies CSSProperties,
  rowLeft: { display: "flex", alignItems: "center", gap: 8 } satisfies CSSProperties,
  rowRight: { display: "flex", alignItems: "center", gap: 6, flexShrink: 0 } satisfies CSSProperties,
  handleSlot: {
    width: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  } satisfies CSSProperties,
  dragHandle: {
    background: "none",
    border: "none",
    cursor: "grab",
    color: "var(--text-muted)",
    display: "inline-flex",
    padding: 4,
  } satisfies CSSProperties,
} as const;
