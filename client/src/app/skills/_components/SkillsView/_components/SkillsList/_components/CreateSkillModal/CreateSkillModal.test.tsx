import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../../../messages/en/skills.json";

const mutateAsync = vi.fn().mockResolvedValue({ id: "sk1", name: "New Skill" });
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));
vi.mock("@/lib/hooks/skills", () => ({
  useCreateSkill: () => ({ mutateAsync, isPending: false }),
}));

import { CreateSkillModal } from "./CreateSkillModal";

afterEach(cleanup);

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("CreateSkillModal (smoke)", () => {
  it("fills the form and submits to useCreateSkill", async () => {
    renderWithIntl(<CreateSkillModal onClose={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText("pr-quality-rubric"), {
      target: { value: "test-quality-rubric" },
    });
    fireEvent.change(screen.getByPlaceholderText("What this skill checks for"), {
      target: { value: "  Flags missing tests  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "test-quality-rubric",
          description: "Flags missing tests",
        }),
      ),
    );
  });

  it("keeps submit disabled until a description is provided", () => {
    renderWithIntl(<CreateSkillModal onClose={() => {}} />);

    const submit = screen.getByRole("button", { name: "Create skill" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText("What this skill checks for"), {
      target: { value: "Flags missing tests" },
    });
    expect(submit.disabled).toBe(false);
  });
});
