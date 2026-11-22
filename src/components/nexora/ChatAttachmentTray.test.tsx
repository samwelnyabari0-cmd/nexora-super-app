import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChatAttachmentTray } from "./ChatAttachmentTray";

describe("ChatAttachmentTray", () => {
  it("shows the six labelled actions in a two-column tray", () => {
    const actions = {
      gallery: vi.fn(),
      document: vi.fn(),
      location: vi.fn(),
      goLive: vi.fn(),
      ephemeral: vi.fn(),
      aiAssist: vi.fn(),
    };

    render(<ChatAttachmentTray actions={actions} />);
    fireEvent.click(screen.getByRole("button", { name: "Open attachment options" }));

    for (const label of ["Gallery", "Document", "Location", "Go Live", "1h live location", "AI Assist"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("runs only the selected action and closes the tray", () => {
    const actions = {
      gallery: vi.fn(),
      document: vi.fn(),
      location: vi.fn(),
      goLive: vi.fn(),
      ephemeral: vi.fn(),
      aiAssist: vi.fn(),
    };

    render(<ChatAttachmentTray actions={actions} />);
    fireEvent.click(screen.getByRole("button", { name: "Open attachment options" }));
    fireEvent.click(screen.getByRole("button", { name: "Location" }));

    expect(actions.location).toHaveBeenCalledTimes(1);
    expect(actions.gallery).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "AI Assist" })).not.toBeInTheDocument();
  });
});
