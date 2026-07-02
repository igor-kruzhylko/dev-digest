import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
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
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));

    await Promise.resolve();
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: "test-quality-rubric" }),
    );
  });
});
