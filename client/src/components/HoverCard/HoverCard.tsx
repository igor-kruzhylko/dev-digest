/* HoverCard — lightweight hover-triggered popover. The panel is portalled to
   document.body so table cards / accordions with overflow clipping cannot cut
   it off. A short close delay keeps trigger-to-panel pointer movement stable. */
"use client";

import React from "react";
import { OverlayPortal } from "@/vendor/ui/kit/OverlayPortal";

export function HoverCard({
  children,
  content,
  align = "left",
  width = 380,
  open,
  onOpenChange,
  onClose,
}: {
  /** The always-visible trigger. */
  children: React.ReactNode;
  /** Panel content, shown on hover. Null/undefined -> no popover. */
  content: React.ReactNode;
  align?: "left" | "right";
  width?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
}) {
  const [localOpen, setLocalOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLSpanElement | null>(null);
  const closeTimer = React.useRef<number | null>(null);
  const controlled = open !== undefined;
  const actualOpen = controlled ? open : localOpen;

  const clearCloseTimer = React.useCallback(() => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const setActualOpen = React.useCallback(
    (next: boolean) => {
      clearCloseTimer();
      if (!controlled) setLocalOpen(next);
      onOpenChange?.(next);
      if (!next) onClose?.();
    },
    [clearCloseTimer, controlled, onClose, onOpenChange],
  );

  const scheduleClose = React.useCallback(() => {
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => setActualOpen(false), 110);
  }, [clearCloseTimer, setActualOpen]);

  React.useEffect(() => clearCloseTimer, [clearCloseTimer]);

  if (!content) return <>{children}</>;
  return (
    <span
      ref={rootRef}
      style={{ display: "inline-flex" }}
      onMouseEnter={() => setActualOpen(true)}
      onMouseLeave={scheduleClose}
      onFocus={() => setActualOpen(true)}
      onBlur={scheduleClose}
      // The trigger often sits inside a clickable row; keep popover clicks local.
      onClick={(e) => e.stopPropagation()}
    >
      {children}
      <OverlayPortal
        open={!!actualOpen}
        anchorRef={rootRef}
        align={align}
        width={width}
        role="tooltip"
        onMouseEnter={() => setActualOpen(true)}
        onMouseLeave={scheduleClose}
        onClick={(e) => e.stopPropagation()}
        style={{ cursor: "default" }}
      >
        <div style={{ width: "100%", maxWidth: "min(420px, calc(100vw - 16px))" }}>
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
      </OverlayPortal>
    </span>
  );
}
