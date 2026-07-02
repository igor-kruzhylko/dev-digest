import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../../../messages/en/skills.json";

vi.mock("@/lib/hooks/skills", () => ({
  useSkillUsage: () => ({
    data: {
      skill_id: "sk1",
      agent_count: 2,
      agents: [
        { id: "a1", name: "Test Quality Reviewer" },
        { id: "a2", name: "API Contract Reviewer" },
      ],
    },
    isLoading: false,
  }),
}));

import { StatsTab } from "./StatsTab";

afterEach(cleanup);

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("StatsTab (smoke)", () => {
  it("renders real USED BY count and agents-using links", () => {
    renderWithIntl(<StatsTab skillId="sk1" />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Test Quality Reviewer")).toBeInTheDocument();
    expect(screen.getByText("API Contract Reviewer")).toBeInTheDocument();
  });

  it("renders 'not tracked yet' for cards with no data source (no fabricated numbers)", () => {
    renderWithIntl(<StatsTab skillId="sk1" />);
    const notTracked = screen.getAllByText("not tracked yet");
    expect(notTracked.length).toBe(4);
  });
});
