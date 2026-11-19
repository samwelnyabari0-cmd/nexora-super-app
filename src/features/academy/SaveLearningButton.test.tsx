import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { saveLearningItem, unsaveLearningItem } from "./savedLearning";
import { SaveLearningButton } from "./SaveLearningButton";

vi.mock("@/lib/session", () => ({
  useSession: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

vi.mock("./savedLearning", () => ({
  saveLearningItem: vi.fn(),
  unsaveLearningItem: vi.fn(),
}));

describe("SaveLearningButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    (supabase as any).from.mockReturnValue(query);
    (saveLearningItem as any).mockResolvedValue({ error: null });
    (unsaveLearningItem as any).mockResolvedValue({ error: null });
  });

  it("loads the current user's saved state", async () => {
    render(<SaveLearningButton itemType="course" itemId="course-1" />);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith("edu_saved_items");
    });
    expect(await screen.findByRole("button", { name: "Save to learning" })).toBeInTheDocument();
  });

  it("saves an item and changes the accessible state", async () => {
    render(<SaveLearningButton itemType="lesson" itemId="lesson-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Save to learning" }));

    await waitFor(() => {
      expect(saveLearningItem).toHaveBeenCalledWith("user-1", "lesson", "lesson-1");
    });
    expect(await screen.findByRole("button", { name: "Remove from saved learning" })).toBeInTheDocument();
  });

  it("removes an item that is already saved", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "saved-1" }, error: null }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    (supabase as any).from.mockReturnValue(query);

    render(<SaveLearningButton itemType="educator" itemId="educator-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Remove from saved learning" }));

    await waitFor(() => {
      expect(unsaveLearningItem).toHaveBeenCalledWith("user-1", "educator", "educator-1");
    });
    expect(await screen.findByRole("button", { name: "Save to learning" })).toBeInTheDocument();
  });

  it("keeps the button state unchanged when the save request fails", async () => {
    (saveLearningItem as any).mockResolvedValue({ error: { message: "write denied" } });
    render(<SaveLearningButton itemType="resource" itemId="resource-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Save to learning" }));

    await waitFor(() => expect(saveLearningItem).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: "Save to learning" })).toBeInTheDocument();
  });
});
