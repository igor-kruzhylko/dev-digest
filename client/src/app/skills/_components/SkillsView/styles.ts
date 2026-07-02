import type { CSSProperties } from "react";
import { LIST_WIDTH } from "./constants";

/** Co-located styles for the SkillsView two-pane shell. */
export const s = {
  shell: { display: "flex", height: "calc(100vh - 52px)" } satisfies CSSProperties,
  listCol: {
    width: LIST_WIDTH,
    flexShrink: 0,
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    background: "var(--bg-surface)",
  } satisfies CSSProperties,
  detailCol: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 } satisfies CSSProperties,
  selectPrompt: { flex: 1 } satisfies CSSProperties,
} as const;
