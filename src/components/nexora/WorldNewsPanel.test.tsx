import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorldNewsPanel } from "@/components/nexora/WorldNewsPanel";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  result: { data: [] as Record<string, unknown>[], error: null as null | { message: string } },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from },
}));

function makeNews(provider: string, provider_id: string, headline: string, source_name: string) {
  return {
    provider,
    provider_id,
    headline,
    source_name,
    summary: "A short publisher summary.",
    source_url: "https://publisher.example/story",
    published_at: new Date().toISOString(),
  };
}

describe("WorldNewsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.result.data = [
      makeNews("world-bbc-rss", "world-1", "World leaders meet today", "BBC World"),
      makeNews("kenya-google-news-rss", "kenya-1", "Kenya announces new measures", "Daily Nation"),
      makeNews("world-dw-rss", "world-2", "Global climate report released", "DW News"),
      makeNews("kenya-bbc-africa-rss", "kenya-2", "East Africa regional update", "BBC Africa"),
      makeNews("world-aljazeera-rss", "world-3", "International aid talks continue", "Al Jazeera"),
      makeNews("kenya-google-news-rss", "kenya-3", "Kenya county news update", "The Standard"),
    ];
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "in", "eq", "order"]) {
      chain[method] = vi.fn(() => chain);
    }
    chain.limit = vi.fn(async () => mocks.result);
    mocks.from.mockReturnValue(chain);
  });

  it("loads publisher headlines and filters World and Kenya separately", async () => {
    render(<WorldNewsPanel variant="full" />);

    expect(await screen.findByText("World leaders meet today")).toBeInTheDocument();
    expect(screen.getByText("Kenya announces new measures")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Kenya" }));
    expect(screen.getByText("Kenya announces new measures")).toBeInTheDocument();
    expect(screen.queryByText("World leaders meet today")).not.toBeInTheDocument();
  });

  it("shows only the five most recent stories in Morning Briefing", async () => {
    render(<WorldNewsPanel variant="briefing" maxItems={5} />);

    expect(await screen.findByText("World leaders meet today")).toBeInTheDocument();
    expect(screen.queryByText("Kenya county news update")).not.toBeInTheDocument();
  });

  it("offers a lightweight reader toggle", async () => {
    render(<WorldNewsPanel variant="full" />);

    expect(await screen.findByText("World leaders meet today")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lite reader on" }));
    expect(screen.getByRole("button", { name: "Lite reader off" })).toBeInTheDocument();
  });
});
