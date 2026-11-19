import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { CreatorContentManager } from "./CreatorContentManager";

vi.mock("@/lib/session", () => ({
  useSession: () => ({ user: { id: "creator-1" } }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function queryResult(data: unknown) {
  const query: any = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    in: vi.fn(() => query),\n    update: vi.fn(() => query),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data, error: null }).then(resolve, reject),
  };
  return query;
}

describe("CreatorContentManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (supabase as any).from.mockImplementation((table: string) => {
      if (table === "edu_courses") return queryResult([{
        id: "course-1",
        title: "React Bootcamp",
        description: "Learn React",
        category: "tech",
        is_published: true,
        publication_status: "published",
        published_at: "2026-09-01T10:00:00.000Z",
        last_published_at: "2026-09-01T10:00:00.000Z",
        skill_tags: ["React"],
        created_at: "2026-09-01T10:00:00.000Z",
        updated_at: "2026-09-02T10:00:00.000Z",
      }]);
      if (table === "edu_lessons") return queryResult([
        { id: "lesson-1", course_id: "course-1", title: "Components", lesson_order: 1, publication_status: "published", published_at: "2026-09-01T10:00:00.000Z" },
        { id: "lesson-2", course_id: "course-1", title: "Hooks", lesson_order: 2, publication_status: "draft", published_at: null },
      ]);
      if (table === "edu_resources") return queryResult([
        { id: "resource-1", course_id: "course-1", resource_name: "React notes.pdf", file_type: "pdf", file_size_bytes: 1024, publication_status: "draft", published_at: null },
      ]);
      if (table === "edu_enrollments") return queryResult([
        { course_id: "course-1", student_id: "student-1", status: "active" },
        { course_id: "course-1", student_id: "student-1", status: "completed" },
      ]);
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("loads only the signed-in creator's courses and displays real content counts", async () => {
    render(<CreatorContentManager />);

    expect(await screen.findByText("React Bootcamp")).toBeInTheDocument();
    expect(screen.getByText("2 lessons")).toBeInTheDocument();
    expect(screen.getByText("1 resource")).toBeInTheDocument();
    expect(screen.getByText("1 learner")).toBeInTheDocument();
    expect(supabase.from).toHaveBeenCalledWith("edu_courses");
  });

  it("shows the independent lesson and resource lists", async () => {
    render(<CreatorContentManager />);

    fireEvent.click(await screen.findByRole("button", { name: /Lessons/ }));
    expect(await screen.findByText("Components")).toBeInTheDocument();
    expect(screen.getByText("Hooks")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Resources/ }));
    expect(await screen.findByText("React notes.pdf")).toBeInTheDocument();
  });

  it("filters content by publication status", async () => {
    render(<CreatorContentManager />);

    fireEvent.click(await screen.findByRole("button", { name: /Lessons/ }));
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "draft" } });

    expect(screen.getByText("Hooks")).toBeInTheDocument();
    expect(screen.queryByText("Components")).not.toBeInTheDocument();
  });
});
