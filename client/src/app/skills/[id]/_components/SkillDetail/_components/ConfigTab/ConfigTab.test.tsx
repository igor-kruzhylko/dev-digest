import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";

vi.mock("@/lib/hooks/skills", () => ({
  useUpdateSkill: () => ({ mutate: vi.fn(), isPending: false, isSuccess: false, data: undefined }),
}));

import { ConfigTab } from "./ConfigTab";

afterEach(cleanup);

const SKILL: Skill = {
  id: "sk1",
  name: "pr-quality-rubric",
  description: "Flags missing tests",
  type: "rubric",
  source: "manual",
  body: "# Rule\nBe thorough.",
  enabled: true,
  version: 4,
};

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <ToastProvider>{ui}</ToastProvider>
    </NextIntlClientProvider>,
  );
}

describe("ConfigTab (smoke)", () => {
  it("shows the version badge", () => {
    renderWithIntl(<ConfigTab skill={SKILL} />);
    expect(screen.getByText("v4")).toBeInTheDocument();
  });

  it("shows the unsaved badge only after an edit", () => {
    renderWithIntl(<ConfigTab skill={SKILL} />);
    expect(screen.queryByText("unsaved")).not.toBeInTheDocument();

    const nameInput = screen.getByDisplayValue("pr-quality-rubric");
    fireEvent.change(nameInput, { target: { value: "pr-quality-rubric-v2" } });

    expect(screen.getByText("unsaved")).toBeInTheDocument();
  });
});
