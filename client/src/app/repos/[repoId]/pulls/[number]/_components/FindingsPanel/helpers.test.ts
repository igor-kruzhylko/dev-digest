import { describe, it, expect } from "vitest";
import type { FindingRecord } from "@devdigest/shared";
import { visibleFindings } from "./helpers";

function f(over: Partial<FindingRecord> & Pick<FindingRecord, "id" | "severity">): FindingRecord {
  return {
    category: "bug",
    title: over.id,
    file: "src/x.ts",
    start_line: 1,
    end_line: 1,
    rationale: "r",
    suggestion: null,
    confidence: 0.9,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
    ...over,
  } as FindingRecord;
}

const FINDINGS: FindingRecord[] = [
  f({ id: "sugg", severity: "SUGGESTION" }),
  f({ id: "crit", severity: "CRITICAL" }),
  f({ id: "warn", severity: "WARNING" }),
  f({ id: "crit-low", severity: "CRITICAL", confidence: 0.3 }),
];

describe("visibleFindings — severityFilter", () => {
  it("is a no-op when severityFilter is null/undefined (just sorts by severity)", () => {
    const shown = visibleFindings(FINDINGS, false, null);
    expect(shown.map((x) => x.id)).toEqual(["crit", "crit-low", "warn", "sugg"]);
  });

  it("narrows to a single severity", () => {
    const shown = visibleFindings(FINDINGS, false, "CRITICAL");
    expect(shown.map((x) => x.id)).toEqual(["crit", "crit-low"]);
  });

  it("combines with hideLow (drops low-confidence within the chosen severity)", () => {
    const shown = visibleFindings(FINDINGS, true, "CRITICAL");
    expect(shown.map((x) => x.id)).toEqual(["crit"]);
  });

  it("returns empty when no finding matches the severity", () => {
    const onlyWarn = [f({ id: "warn", severity: "WARNING" })];
    expect(visibleFindings(onlyWarn, false, "CRITICAL")).toEqual([]);
  });
});
