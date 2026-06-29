/* SeverityFilterBar — PR-wide finding counters per severity. Clicking a chip
   filters every run's findings down to that severity; clicking the active one
   (or "All") clears it. Counts aggregate across all runs and ignore the
   per-panel hide-low-confidence toggle. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Chip, SEV } from "@devdigest/ui";
import type { FindingRecord, Severity } from "@devdigest/shared";
import { SEVERITY_ORDER } from "../FindingsPanel/constants";
import { s } from "./styles";

/** Severities shown in the bar, worst-first. */
const SEVERITIES: Severity[] = ["CRITICAL", "WARNING", "SUGGESTION"];

export function SeverityFilterBar({
  findings,
  active,
  onChange,
}: {
  findings: FindingRecord[];
  active: Severity | null;
  onChange: (sev: Severity | null) => void;
}) {
  const t = useTranslations("prReview");

  const counts = React.useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of findings) c[f.severity] = (c[f.severity] ?? 0) + 1;
    return c;
  }, [findings]);

  const present = SEVERITIES.filter((sev) => (counts[sev] ?? 0) > 0).sort(
    (a, b) => (SEVERITY_ORDER[a] ?? 9) - (SEVERITY_ORDER[b] ?? 9),
  );

  return (
    <div style={s.bar}>
      <Chip active={active === null} onClick={() => onChange(null)}>
        {t("severityFilter.all")}
      </Chip>
      {present.map((sev) => (
        <Chip
          key={sev}
          active={active === sev}
          color={SEV[sev].c}
          icon={SEV[sev].icon}
          count={counts[sev]}
          onClick={() => onChange(active === sev ? null : sev)}
        >
          {SEV[sev].label}
        </Chip>
      ))}
    </div>
  );
}
