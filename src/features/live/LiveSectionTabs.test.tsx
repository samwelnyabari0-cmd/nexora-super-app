import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LiveSectionTabs, type LiveSection } from "./LiveSectionTabs";

describe("LiveSectionTabs", () => {
  it("shows the three focused views and selects the requested view", () => {
    const onChange = vi.fn();
    render(<LiveSectionTabs active="watch" onChange={onChange} />);

    expect(screen.getByRole("tab", { name: "Watch" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Go Live & Studio" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Map & Co-watch" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Go Live & Studio" }));
    expect(onChange).toHaveBeenCalledWith("studio" satisfies LiveSection);
  });
});
