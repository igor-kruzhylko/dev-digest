import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Dropdown } from "./Dropdown";

afterEach(cleanup);

describe("Dropdown", () => {
  it("renders its menu in a portal and closes after selecting an item", () => {
    const onClick = vi.fn();
    const { container } = render(
      <Dropdown
        trigger={<button type="button">Open menu</button>}
        items={[{ label: "Run all", icon: "Play", onClick }]}
      />,
    );

    fireEvent.click(screen.getByText("Open menu"));

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(container.querySelector('[role="menu"]')).toBeNull();

    fireEvent.click(screen.getByText("Run all"));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
