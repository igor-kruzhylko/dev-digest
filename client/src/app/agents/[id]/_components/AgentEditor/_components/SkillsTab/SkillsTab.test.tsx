import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Agent, AgentSkillLink, Skill } from "@devdigest/shared";
import agentsMessages from "../../../../../../../../messages/en/agents.json";
import skillsMessages from "../../../../../../../../messages/en/skills.json";

const AGENT: Agent = {
  id: "ag1",
  name: "Test Quality Reviewer",
  description: "",
  provider: "openai",
  model: "gpt-4.1",
  system_prompt: "Review.",
  output_schema: null,
  strategy: "single-pass",
  ci_fail_on: "critical",
  repo_intel: true,
  enabled: true,
  version: 1,
};

const SKILLS: Skill[] = [
  {
    id: "sk-a",
    name: "skill-a",
    description: "A",
    type: "rubric",
    source: "manual",
    body: "a",
    enabled: true,
    version: 1,
  },
  {
    id: "sk-b",
    name: "skill-b",
    description: "B",
    type: "convention",
    source: "manual",
    body: "b",
    enabled: true,
    version: 1,
  },
  {
    id: "sk-c",
    name: "skill-c",
    description: "C",
    type: "custom",
    source: "manual",
    body: "c",
    enabled: true,
    version: 1,
  },
];

// a + b linked, in that order; c is unattached.
const LINKS: AgentSkillLink[] = [
  { agent_id: "ag1", skill_id: "sk-a", order: 0 },
  { agent_id: "ag1", skill_id: "sk-b", order: 1 },
];

const mutate = vi.fn();

vi.mock("@/lib/hooks/agents", () => ({
  useAgentSkills: () => ({ data: LINKS, isLoading: false }),
  useSetAgentSkills: () => ({ mutate, isPending: false }),
}));

vi.mock("@/lib/hooks/skills", () => ({
  useSkills: () => ({ data: SKILLS, isLoading: false, isError: false, refetch: vi.fn() }),
}));

import { SkillsTab } from "./SkillsTab";

afterEach(() => {
  cleanup();
  mutate.mockClear();
});

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ agents: agentsMessages, skills: skillsMessages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("SkillsTab (smoke)", () => {
  it("lists all workspace skills, linked ones checked, in link order first", () => {
    renderWithIntl(<SkillsTab agent={AGENT} />);
    expect(screen.getByText("2 of 3 linked")).toBeInTheDocument();
    const rows = screen.getAllByText(/skill-[abc]/).map((el) => el.textContent);
    expect(rows).toEqual(["skill-a", "skill-b", "skill-c"]);
  });

  it("checking an unattached skill persists it appended to the linked order", () => {
    renderWithIntl(<SkillsTab agent={AGENT} />);
    const label = screen.getByText("skill-c").closest("label") as HTMLElement;
    fireEvent.click(within(label).getByRole("checkbox"));
    expect(mutate).toHaveBeenCalledWith({ agentId: "ag1", skillIds: ["sk-a", "sk-b", "sk-c"] });
  });

  it("unchecking a linked skill persists it removed", () => {
    renderWithIntl(<SkillsTab agent={AGENT} />);
    const label = screen.getByText("skill-a").closest("label") as HTMLElement;
    fireEvent.click(within(label).getByRole("checkbox"));
    expect(mutate).toHaveBeenCalledWith({ agentId: "ag1", skillIds: ["sk-b"] });
  });

  it("moving the second linked skill up swaps the persisted order", () => {
    renderWithIntl(<SkillsTab agent={AGENT} />);
    const moveUpButtons = screen.getAllByLabelText("Move up");
    // First linked row (skill-a) has its "Move up" disabled; the second (skill-b) is enabled.
    fireEvent.click(moveUpButtons[1]!);
    expect(mutate).toHaveBeenCalledWith({ agentId: "ag1", skillIds: ["sk-b", "sk-a"] });
  });
});
