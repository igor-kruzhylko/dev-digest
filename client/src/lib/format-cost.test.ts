import { describe, it, expect } from "vitest";
import { formatUsd, formatTokenFlow } from "./format-cost";

describe("formatUsd", () => {
  it("renders — (not $0.00) when cost is unknown", () => {
    expect(formatUsd(null)).toBe("—");
    expect(formatUsd(undefined)).toBe("—");
    expect(formatUsd(NaN)).toBe("—");
    expect(formatUsd(Infinity)).toBe("—");
  });

  it("keeps at least 3 meaningful digits for small costs (never $0.01)", () => {
    expect(formatUsd(0.0134)).toBe("$0.0134");
    expect(formatUsd(0.012)).toBe("$0.012");
    expect(formatUsd(0.0013)).toBe("$0.0013");
    expect(formatUsd(0.00012)).toBe("$0.00012");
  });

  it("uses 2 decimals at or above $1", () => {
    expect(formatUsd(1.2345)).toBe("$1.23");
    expect(formatUsd(12)).toBe("$12.00");
  });

  it("renders a genuine zero as $0.000, not —", () => {
    expect(formatUsd(0)).toBe("$0.000");
  });
});

describe("formatTokenFlow", () => {
  it("renders compact in→out flow with uppercase K", () => {
    expect(formatTokenFlow(8200, 1300)).toBe("8.2K→1.3K");
  });

  it("renders raw counts below 1000 and treats null as 0", () => {
    expect(formatTokenFlow(500, 50)).toBe("500→50");
    expect(formatTokenFlow(null, undefined)).toBe("0→0");
  });
});
