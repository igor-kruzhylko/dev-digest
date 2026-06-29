import React from "react";
import { createPortal } from "react-dom";

type Align = "left" | "right";

interface Position {
  top: number;
  left: number;
  ready: boolean;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

export function OverlayPortal({
  open,
  anchorRef,
  overlayRef,
  align = "left",
  width,
  offset = 6,
  margin = 8,
  zIndex = 1000,
  style,
  children,
  ...events
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  overlayRef?: React.MutableRefObject<HTMLDivElement | null>;
  align?: Align;
  width?: number;
  offset?: number;
  margin?: number;
  zIndex?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
} & Pick<
  React.HTMLAttributes<HTMLDivElement>,
  "role" | "onClick" | "onMouseDown" | "onMouseEnter" | "onMouseLeave"
>) {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const frameRef = React.useRef<number | null>(null);
  const [position, setPosition] = React.useState<Position>({ top: 0, left: 0, ready: false });

  const setPanelRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      panelRef.current = node;
      if (overlayRef) overlayRef.current = node;
    },
    [overlayRef],
  );

  const updatePosition = React.useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor || typeof window === "undefined") return;

    const anchorRect = anchor.getBoundingClientRect();
    const panelRect = panelRef.current?.getBoundingClientRect();
    const panelWidth = panelRect?.width || width || anchorRect.width;
    const panelHeight = panelRect?.height || 0;
    const maxLeft = Math.max(margin, window.innerWidth - panelWidth - margin);
    const preferredLeft = align === "right" ? anchorRect.right - panelWidth : anchorRect.left;

    let top = anchorRect.bottom + offset;
    if (
      panelHeight > 0 &&
      top + panelHeight > window.innerHeight - margin &&
      anchorRect.top - offset - panelHeight >= margin
    ) {
      top = anchorRect.top - offset - panelHeight;
    } else if (panelHeight > 0) {
      top = clamp(top, margin, Math.max(margin, window.innerHeight - panelHeight - margin));
    }

    setPosition({
      top,
      left: clamp(preferredLeft, margin, maxLeft),
      ready: true,
    });
  }, [align, anchorRef, margin, offset, width]);

  const scheduleUpdate = React.useCallback(() => {
    if (typeof window === "undefined") return;
    if (frameRef.current != null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      updatePosition();
    });
  }, [updatePosition]);

  React.useLayoutEffect(() => {
    if (!open) {
      setPosition((p) => ({ ...p, ready: false }));
      return;
    }

    updatePosition();
    const anchor = anchorRef.current;
    const panel = panelRef.current;

    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(scheduleUpdate);
      if (anchor) resizeObserver.observe(anchor);
      if (panel) resizeObserver.observe(panel);
    }

    return () => {
      if (frameRef.current != null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
      resizeObserver?.disconnect();
    };
  }, [anchorRef, open, scheduleUpdate, updatePosition]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      {...events}
      ref={setPanelRef}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        width,
        maxWidth: `calc(100vw - ${margin * 2}px)`,
        zIndex,
        visibility: position.ready ? "visible" : "hidden",
        ...style,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
