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
  {
    id: "sk-d",
    name: "skill-d",
    description: "D",
    type: "custom",
    source: "manual",
    body: "d",
    enabled: true,
    version: 1,
  },
];

// a + b + c linked, in that order; d is unattached.
const LINKS: AgentSkillLink[] = [
  { agent_id: "ag1", skill_id: "sk-a", order: 0 },
  { agent_id: "ag1", skill_id: "sk-b", order: 1 },
  { agent_id: "ag1", skill_id: "sk-c", order: 2 },
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
    expect(screen.getByText("3 of 4 linked")).toBeInTheDocument();
    const rows = screen.getAllByText(/skill-[abcd]/).map((el) => el.textContent);
    expect(rows).toEqual(["skill-a", "skill-b", "skill-c", "skill-d"]);
  });

  it("checking an unattached skill persists it appended to the linked order", () => {
    renderWithIntl(<SkillsTab agent={AGENT} />);
    const label = screen.getByText("skill-d").closest("label") as HTMLElement;
    fireEvent.click(within(label).getByRole("checkbox"));
    expect(mutate).toHaveBeenCalledWith({ agentId: "ag1", skillIds: ["sk-a", "sk-b", "sk-c", "sk-d"] });
  });

  it("unchecking a linked skill persists it removed", () => {
    renderWithIntl(<SkillsTab agent={AGENT} />);
    const label = screen.getByText("skill-a").closest("label") as HTMLElement;
    fireEvent.click(within(label).getByRole("checkbox"));
    expect(mutate).toHaveBeenCalledWith({ agentId: "ag1", skillIds: ["sk-b", "sk-c"] });
  });

  it("dragging the second linked skill onto the first persists the swapped order", () => {
    renderWithIntl(<SkillsTab agent={AGENT} />);
    const handles = screen.getAllByLabelText("Drag to reorder");
    const rowOf = (text: string) =>
      screen.getByText(text).closest("label")!.parentElement!.parentElement as HTMLElement;
    const dataTransfer = { setData: vi.fn(), setDragImage: vi.fn(), effectAllowed: "" };
    // handles[0] = skill-a's handle, handles[1] = skill-b's handle.
    fireEvent.dragStart(handles[1]!, { dataTransfer });
    fireEvent.dragOver(rowOf("skill-a"), { dataTransfer });
    fireEvent.drop(rowOf("skill-a"), { dataTransfer });
    expect(mutate).toHaveBeenCalledWith({ agentId: "ag1", skillIds: ["sk-b", "sk-a", "sk-c"] });
  });

  it("dragging the first linked skill onto the third lands it at the third slot (not the second)", () => {
    renderWithIntl(<SkillsTab agent={AGENT} />);
    const handles = screen.getAllByLabelText("Drag to reorder");
    const rowOf = (text: string) =>
      screen.getByText(text).closest("label")!.parentElement!.parentElement as HTMLElement;
    const dataTransfer = { setData: vi.fn(), setDragImage: vi.fn(), effectAllowed: "" };
    // handles[0] = skill-a's handle (dragged onto skill-c, the third linked row).
    fireEvent.dragStart(handles[0]!, { dataTransfer });
    fireEvent.dragOver(rowOf("skill-c"), { dataTransfer });
    fireEvent.drop(rowOf("skill-c"), { dataTransfer });
    expect(mutate).toHaveBeenCalledWith({ agentId: "ag1", skillIds: ["sk-b", "sk-c", "sk-a"] });
  });
});
