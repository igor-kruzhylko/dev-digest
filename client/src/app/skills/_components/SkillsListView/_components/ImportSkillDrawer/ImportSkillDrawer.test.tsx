import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../messages/en/skills.json";

const previewMutate = vi.fn((_input, opts?: { onError?: (e: unknown) => void }) => {
  void opts;
});
const createMutateAsync = vi.fn().mockResolvedValue({ id: "sk2", name: "imported-skill" });
const push = vi.fn();

let previewData: unknown = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));
vi.mock("@/lib/hooks/skills", () => ({
  useImportSkillPreview: () => ({
    mutate: previewMutate,
    reset: vi.fn(),
    isPending: false,
    data: previewData,
  }),
  useCreateSkill: () => ({ mutateAsync: createMutateAsync, isPending: false }),
}));

import { ImportSkillDrawer } from "./ImportSkillDrawer";

afterEach(() => {
  cleanup();
  previewData = null;
  previewMutate.mockClear();
  createMutateAsync.mockClear();
});

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("ImportSkillDrawer (smoke)", () => {
  it("renders the preview once useImportSkillPreview has data", () => {
    previewData = {
      name: "imported-skill",
      description: "desc",
      type: "custom",
      body: "# Rule",
      source: "extracted",
      warnings: [],
      ignored_files: [],
    };
    renderWithIntl(<ImportSkillDrawer onClose={() => {}} />);
    expect(screen.getByText("imported-skill")).toBeInTheDocument();
    expect(screen.getByText(/untrusted source/i)).toBeInTheDocument();
  });

  it("Save calls useCreateSkill with enabled:false once a preview exists", async () => {
    previewData = {
      name: "imported-skill",
      description: "desc",
      type: "custom",
      body: "# Rule",
      source: "extracted",
      warnings: [],
      ignored_files: [],
    };
    renderWithIntl(<ImportSkillDrawer onClose={() => {}} />);

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() =>
      expect(createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ name: "imported-skill", enabled: false }),
      ),
    );
  });
});
