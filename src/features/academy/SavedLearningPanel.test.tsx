import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { listSavedLearningItems, unsaveLearningItem } from "./savedLearning";
import { SavedLearningPanel } from "./SavedLearningPanel";

vi.mock("@/lib/session", () => ({
  useSession: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

vi.mock("./savedLearning", () => ({
  listSavedLearningItems: vi.fn(),
  unsaveLearningItem: vi.fn(),
}));

const savedCourse = {
  id: "saved-row-1",
  user_id: "user-1",
  item_type: "course",
  course_id: "course-1",
  lesson_id: null,
  resource_id: null,
  educator_id: null,
  saved_at: "2026-11-19T00:00:00.000Z",
};

describe("SavedLearningPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (listSavedLearningItems as any).mockResolvedValue({
      data: [savedCourse],
      error: null,
    });
    const query = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [{
          id: "course-1",
          title: "React Bootcamp",
          description: "Learn React",
          category: "tech",
          level: "beginner",
          thumbnail_url: null,
        }],
        error: null,
      }),
    };
    (supabase as any).from.mockReturnValue(query);
    (unsaveLearningItem as any).mockResolvedValue({ error: null });
  });

  it("renders saved courses returned for the signed-in owner", async () => {
    render(<SavedLearningPanel onOpenCourse={vi.fn()} onOpenEducator={vi.fn()} />);

    expect(await screen.findByText("React Bootcamp")).toBeInTheDocument();
    expect(screen.getByText("Courses")).toBeInTheDocument();
  });

  it("opens a saved course through the existing Academy course flow", async () => {
    const onOpenCourse = vi.fn();
    render(<SavedLearningPanel onOpenCourse={onOpenCourse} onOpenEducator={vi.fn()} />);

    await screen.findByText("React Bootcamp");
    fireEvent.click(screen.getByRole("button", { name: "Open course" }));

    expect(onOpenCourse).toHaveBeenCalledWith("course-1");
  });

  it("removes a saved item without granting course access", async () => {
    render(<SavedLearningPanel onOpenCourse={vi.fn()} onOpenEducator={vi.fn()} />);

    await screen.findByText("React Bootcamp");
    fireEvent.click(screen.getByRole("button", { name: "Remove saved course" }));

    await waitFor(() => {
      expect(unsaveLearningItem).toHaveBeenCalledWith("user-1", "course", "course-1");
      expect(screen.queryByText("React Bootcamp")).not.toBeInTheDocument();
    });
  });
});
