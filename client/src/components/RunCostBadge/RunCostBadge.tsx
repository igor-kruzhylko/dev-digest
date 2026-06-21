/* RunCostBadge (L01) — shows what one run cost. Two variants:
     compact  → "$0.012"               (PR list COST column)
     detailed → "$0.014 · 8.2K→1.3K"   (verdict row, run timeline)
   Renders "—" (never "$0.00") when cost is unknown or the run isn't complete.
   See client/specs/run-cost-badge.md. */
"use client";

import React from "react";
import { Badge } from "@devdigest/ui";
import { formatUsd, formatTokenFlow } from "@/lib/format-cost";

export function RunCostBadge({
  costUsd,
  tokensIn,
  tokensOut,
  variant,
  status,
}: {
  costUsd: number | null | undefined;
  tokensIn?: number | null;
  tokensOut?: number | null;
  variant: "compact" | "detailed";
  /** Run lifecycle status; anything other than "done" renders the empty state. */
  status?: string | null;
}) {
  const settled = status == null || status === "done";
  const hasCost = settled && costUsd != null && Number.isFinite(costUsd);

  if (!hasCost) {
    return (
      <Badge mono bg="transparent" color="var(--text-muted)">
        —
      </Badge>
    );
  }

  const cost = formatUsd(costUsd);
  const label =
    variant === "detailed"
      ? `${cost} · ${formatTokenFlow(tokensIn, tokensOut)}`
      : cost;

  return (
    <Badge mono bg="transparent" color="var(--text-secondary)" icon="DollarSign">
      {label}
    </Badge>
  );
}

export default RunCostBadge;
