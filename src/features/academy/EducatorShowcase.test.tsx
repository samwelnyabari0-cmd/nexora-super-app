import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { EducatorShowcase } from "./EducatorShowcase";

vi.mock("@/lib/session", () => ({
  useSession: () => ({ user: { id: "viewer-1" } }),
}));

vi.mock("@/features/social/useSocialGraph", () => ({
  useSocialGraph: () => ({
    followers: 12,
    following: 3,
    isFollowing: false,
    loading: false,
    error: null,
    toggleFollow: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("./SaveLearningButton", () => ({ SaveLearningButton: () => null }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
}));

const educator = {
  id: "educator-1",
  display_name: "Ada Developer",
  handle: "ada_codes",
  bio: "Teaching React and WebGL",
  avatar_url: null,
  account_type: "creator",
  profile_category: "education",
  education_skills: ["React", "WebGL"],
};

describe("EducatorShowcase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (supabase as any).rpc.mockImplementation((name: string) => {
      if (name === "get_academy_educator") {
        return Promise.resolve({ data: [educator], error: null });
      }
      if (name === "get_academy_educator_stats") {
        return Promise.resolve({
          data: [{ total_courses: 0, total_lessons: 0, total_students: 0 }],
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    });
    const courseQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    (supabase as any).from.mockReturnValue(courseQuery);
  });

  it("shows eligible educator details, skills and aggregate statistics", async () => {
    render(
      <EducatorShowcase
        educatorId="educator-1"
        onBack={vi.fn()}
        onOpenCourse={vi.fn()}
      />,
    );

    expect(await screen.findByText("Ada Developer")).toBeInTheDocument();
    expect(screen.getByText("@ada_codes")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("WebGL")).toBeInTheDocument();
    expect(screen.getByText("Total courses")).toBeInTheDocument();
    expect(screen.getByText("Students")).toBeInTheDocument();
  });

  it("supports educators who have not published any courses", async () => {
    render(
      <EducatorShowcase
        educatorId="educator-1"
        onBack={vi.fn()}
        onOpenCourse={vi.fn()}
      />,
    );

    expect(await screen.findByText("No Academy courses yet")).toBeInTheDocument();
  });

  it("does not invent ratings or verification badges", async () => {
    render(
      <EducatorShowcase
        educatorId="educator-1"
        onBack={vi.fn()}
        onOpenCourse={vi.fn()}
      />,
    );

    await screen.findByText("Ada Developer");
    expect(screen.queryByText(/rating/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/verified/i)).not.toBeInTheDocument();
  });
});
