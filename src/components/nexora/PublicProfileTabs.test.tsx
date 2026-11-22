import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublicProfileTabs, type PublicProfileTab } from "./PublicProfileTabs";

describe("PublicProfileTabs", () => {
  it("renders all profile sections and marks the active tab", () => {
    render(<PublicProfileTabs activeTab="grid" onChange={() => undefined} />);
    expect(screen.getByRole("tab", { name: "Grid" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Reels" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Store" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Communities" })).toBeInTheDocument();
  });

  it("calls onChange when a tab is selected", () => {
    const onChange = vi.fn<(tab: PublicProfileTab) => void>();
    render(<PublicProfileTabs activeTab="grid" onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Reels" }));
    expect(onChange).toHaveBeenCalledWith("reels");
  });
});
