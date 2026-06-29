/* HoverCard — lightweight hover-triggered popover. The panel is a DOM child of
   the trigger wrapper, so moving the pointer onto it does NOT fire mouseleave
   (React onMouseEnter/Leave ignore descendants) — no flicker, no portal. Keep
   the panel flush to the trigger (top:100%, no margin gap) for the same reason. */
"use client";

import React from "react";

export function HoverCard({
  children,
  content,
  align = "left",
  width = 380,
}: {
  /** The always-visible trigger. */
  children: React.ReactNode;
  /** Panel content, shown on hover. Null/undefined → no popover. */
  content: React.ReactNode;
  align?: "left" | "right";
  width?: number;
}) {
  const [open, setOpen] = React.useState(false);
  if (!content) return <>{children}</>;
  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      // The trigger often sits inside a clickable row — keep popover clicks local.
      onClick={(e) => e.stopPropagation()}
    >
      {children}
      {open && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            top: "100%",
            [align]: 0,
            zIndex: 50,
            width,
            maxWidth: "min(420px, 90vw)",
            paddingTop: 6,
            cursor: "default",
          }}
        >
          <div
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              boxShadow: "0 12px 32px rgba(0,0,0,0.28)",
              padding: 12,
            }}
          >
            {content}
          </div>
        </div>
      )}
    </span>
  );
}
