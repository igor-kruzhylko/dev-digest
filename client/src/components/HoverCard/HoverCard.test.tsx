import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HoverCard } from "./HoverCard";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("HoverCard", () => {
  it("renders the panel in a portal and closes after hover leaves", () => {
    vi.useFakeTimers();

    const { container } = render(
      <div style={{ overflow: "hidden" }}>
        <HoverCard content={<div>Portalled panel</div>}>
          <span>Trigger</span>
        </HoverCard>
      </div>,
    );

    fireEvent.mouseEnter(screen.getByText("Trigger"));

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(container.querySelector('[role="tooltip"]')).toBeNull();

    fireEvent.mouseLeave(screen.getByText("Trigger"));
    act(() => {
      vi.advanceTimersByTime(120);
    });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
