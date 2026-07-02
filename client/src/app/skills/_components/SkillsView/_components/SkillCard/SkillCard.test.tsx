import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/skills.json";
import { SkillCard } from "./SkillCard";

afterEach(cleanup);

const SKILL: Skill = {
  id: "sk1",
  name: "pr-quality-rubric",
  description: "Flags missing tests and unclear naming",
  type: "rubric",
  source: "manual",
  body: "# Rule\nBe thorough.",
  enabled: true,
  version: 3,
};

function renderWithIntl(ui: React.ReactElement) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("SkillCard (smoke)", () => {
  it("renders the skill name, type badge, description and agent count", () => {
    renderWithIntl(<SkillCard skill={SKILL} agentCount={2} />);
    expect(screen.getByText("pr-quality-rubric")).toBeInTheDocument();
    expect(screen.getByText("rubric")).toBeInTheDocument();
    expect(screen.getByText("Flags missing tests and unclear naming")).toBeInTheDocument();
    expect(screen.getByText("2 agents")).toBeInTheDocument();
  });

  it("does not throw when the enabled toggle is clicked", async () => {
    const { container } = renderWithIntl(<SkillCard skill={SKILL} onToggle={() => {}} />);
    const toggle = container.querySelector('[role="switch"]');
    expect(toggle).toBeInTheDocument();
  });

  it("shows the needs-vetting hint for a disabled, non-manual skill", () => {
    renderWithIntl(<SkillCard skill={{ ...SKILL, source: "extracted", enabled: false }} />);
    expect(screen.getByText("needs vetting")).toBeInTheDocument();
  });
});
