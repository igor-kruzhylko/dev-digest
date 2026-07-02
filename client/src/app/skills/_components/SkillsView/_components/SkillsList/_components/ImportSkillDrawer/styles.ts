import type { CSSProperties } from "react";

/** Co-located styles for ImportSkillDrawer. */
export const s = {
  body: { display: "flex", flexDirection: "column", gap: 16 } satisfies CSSProperties,
  footer: { display: "flex", justifyContent: "flex-end", gap: 10 } satisfies CSSProperties,
  fileRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  } satisfies CSSProperties,
  fileName: { fontSize: 13, color: "var(--text-secondary)" } satisfies CSSProperties,
  errorBox: {
    padding: "10px 12px",
    borderRadius: 7,
    background: "var(--crit-bg)",
    border: "1px solid var(--crit)",
    color: "var(--crit)",
    fontSize: 13,
  } satisfies CSSProperties,
  previewBox: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 14,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
  previewHeader: { display: "flex", alignItems: "center", gap: 10 } satisfies CSSProperties,
  previewName: { fontSize: 14, fontWeight: 600 } satisfies CSSProperties,
  bodyPreview: {
    maxHeight: 220,
    overflow: "auto",
    padding: 10,
    borderRadius: 6,
    background: "var(--bg-primary)",
    border: "1px solid var(--border)",
    fontSize: 12,
    whiteSpace: "pre-wrap",
  } satisfies CSSProperties,
  warningList: { margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--warn)" } satisfies CSSProperties,
  ignoredNote: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  trustNotice: {
    padding: "10px 12px",
    borderRadius: 7,
    background: "var(--bg-hover)",
    border: "1px solid var(--border)",
    color: "var(--text-secondary)",
    fontSize: 12,
    lineHeight: 1.5,
  } satisfies CSSProperties,
} as const;
