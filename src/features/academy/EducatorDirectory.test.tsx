import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { EducatorDirectory } from "./EducatorDirectory";

vi.mock("@/lib/session", () => ({
  useSession: () => ({ user: { id: "viewer-1" } }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn() },
}));

const educator = {
  id: "educator-1",
  display_name: "Ada Developer",
  handle: "ada_codes",
  bio: "Teaching web development",
  avatar_url: null,
  account_type: "creator",
  profile_category: "education",
  education_skills: ["React", "WebGL"],
};

describe("EducatorDirectory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (supabase as any).rpc.mockResolvedValue({ data: [educator], error: null });
  });

  it("loads only the educators returned by the secure directory RPC", async () => {
    render(<EducatorDirectory onSelectEducator={vi.fn()} />);

    expect(await screen.findByText("Ada Developer")).toBeInTheDocument();
    expect(supabase.rpc).toHaveBeenCalledWith("search_academy_educators", {
      p_query: null,
      p_skill: null,
      p_limit: 50,
      p_offset: 0,
    });
  });

  it("passes a selected skill chip to the search RPC", async () => {
    render(<EducatorDirectory onSelectEducator={vi.fn()} />);

    await screen.findByText("Ada Developer");
    fireEvent.click(screen.getByRole("button", { name: "WebGL" }));

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenLastCalledWith("search_academy_educators", {
        p_query: null,
        p_skill: "WebGL",
        p_limit: 50,
        p_offset: 0,
      });
    });
  });

  it("opens the selected educator showcase", async () => {
    const onSelectEducator = vi.fn();
    render(<EducatorDirectory onSelectEducator={onSelectEducator} />);

    await screen.findByText("Ada Developer");
    fireEvent.click(screen.getByRole("button", { name: "View educator showcase" }));

    expect(onSelectEducator).toHaveBeenCalledWith("educator-1");
  });

  it("shows a useful error when educator search fails", async () => {
    (supabase as any).rpc.mockResolvedValue({
      data: null,
      error: { message: "Directory unavailable" },
    });
    render(<EducatorDirectory onSelectEducator={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Directory unavailable");
  });
});
