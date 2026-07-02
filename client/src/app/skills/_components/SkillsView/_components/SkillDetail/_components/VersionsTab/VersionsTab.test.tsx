import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill, SkillVersion } from "@devdigest/shared";
import messages from "../../../../../../../../../messages/en/skills.json";

const mutate = vi.fn();

vi.mock("@/lib/hooks/skills", () => ({
  useSkillVersions: () => ({
    data: VERSIONS,
    isLoading: false,
  }),
  useUpdateSkill: () => ({ mutate, isPending: false }),
}));

import { VersionsTab } from "./VersionsTab";

afterEach(() => {
  cleanup();
  mutate.mockClear();
});

const SKILL: Skill = {
  id: "sk1",
  name: "pr-quality-rubric",
  description: "Flags missing tests",
  type: "rubric",
  source: "manual",
  body: "# Rule v2",
  enabled: true,
  version: 2,
};

const VERSIONS: SkillVersion[] = [
  { skill_id: "sk1", version: 2, body: "# Rule v2", label: "Added tests dimension", created_at: "2026-06-01T00:00:00Z" },
  { skill_id: "sk1", version: 1, body: "# Rule v1", label: null, created_at: "2026-05-01T00:00:00Z" },
];

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("VersionsTab (smoke)", () => {
  it("renders the version list newest-first with the current badge", () => {
    renderWithIntl(<VersionsTab skill={SKILL} />);
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("current")).toBeInTheDocument();
    expect(screen.getByText("Added tests dimension")).toBeInTheDocument();
  });

  it("Restore triggers useUpdateSkill with the version's body", () => {
    renderWithIntl(<VersionsTab skill={SKILL} />);
    const restoreButtons = screen.getAllByText("Restore");
    fireEvent.click(restoreButtons[0]!);

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "sk1",
        patch: expect.objectContaining({ body: "# Rule v1", version_label: "Restored v1" }),
      }),
    );
  });
});
