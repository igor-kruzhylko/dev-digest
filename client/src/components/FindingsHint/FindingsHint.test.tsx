import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { Finding } from "@devdigest/shared";
import { SeverityCounts, FindingsHintContent } from "./FindingsHint";

afterEach(cleanup);

function f(over: Partial<Finding> & Pick<Finding, "id" | "severity" | "title">): Finding {
  return {
    category: "bug",
    file: "src/x.ts",
    start_line: 10,
    end_line: 10,
    rationale: "why it matters",
    suggestion: null,
    confidence: 0.9,
    kind: "finding",
    ...over,
  } as Finding;
}

const FINDINGS: Finding[] = [
  f({ id: "c1", severity: "CRITICAL", title: "Hardcoded secret" }),
  f({ id: "c2", severity: "CRITICAL", title: "SSRF in webhook" }),
  f({ id: "w1", severity: "WARNING", title: "N+1 query" }),
  f({ id: "s1", severity: "SUGGESTION", title: "Extract magic number" }),
];

describe("SeverityCounts", () => {
  it("renders a count per present severity", () => {
    render(<SeverityCounts findings={FINDINGS} />);
    // 2 critical, 1 warning, 1 suggestion
    expect(screen.getByTitle("2 critical")).toBeInTheDocument();
    expect(screen.getByTitle("1 warning")).toBeInTheDocument();
    expect(screen.getByTitle("1 suggestion")).toBeInTheDocument();
  });

  it("renders an em-dash when there are no findings", () => {
    render(<SeverityCounts findings={[]} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("FindingsHintContent", () => {
  it("lists every finding with a count header, worst-first", () => {
    render(<FindingsHintContent findings={FINDINGS} />);
    expect(screen.getByText("4 findings")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
    expect(screen.getByText("N+1 query")).toBeInTheDocument();
    expect(screen.getByText("Extract magic number")).toBeInTheDocument();
  });

  it("renders nothing when there are no findings", () => {
    const { container } = render(<FindingsHintContent findings={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
