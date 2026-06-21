import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { RunCostBadge } from "./RunCostBadge";

afterEach(cleanup);

describe("RunCostBadge", () => {
  it("compact variant shows cost only", () => {
    render(<RunCostBadge costUsd={0.012} variant="compact" />);
    expect(screen.getByText("$0.012")).toBeInTheDocument();
  });

  it("detailed variant shows cost + token flow", () => {
    render(
      <RunCostBadge costUsd={0.014} tokensIn={8200} tokensOut={1300} variant="detailed" />,
    );
    expect(screen.getByText("$0.014 · 8.2K→1.3K")).toBeInTheDocument();
  });

  it("renders — (never $0.00) when cost is null", () => {
    render(<RunCostBadge costUsd={null} variant="compact" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders — for a non-completed run even if a cost is present", () => {
    render(<RunCostBadge costUsd={0.05} status="running" variant="detailed" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
