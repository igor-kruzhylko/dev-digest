import type { CSSProperties } from "react";

/** Co-located styles for EvalsTab. */
export const s = {
  wrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 240,
    textAlign: "center",
    color: "var(--text-muted)",
    fontSize: 14,
  } satisfies CSSProperties,
} as const;
