import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MatchCenterPage } from "@/routes/match-center";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
}));

vi.mock("@/components/nexora/ui", () => ({
  PageHeader: ({ title }: { title: string }) => <header>{title}</header>,
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    variant: _variant,
    size: _size,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/features/clubs/useClubData", () => ({
  useClubData: () => ({ directory: [] }),
}));

vi.mock("@/features/football/useMatchCenter", () => ({
  useMatchCenter: () => ({
    matches: [],
    lastUpdated: null,
    goalAlertsEnabled: false,
    setGoalAlertsEnabled: vi.fn(),
    refresh: vi.fn(),
    loading: false,
    error: null,
    favorites: [],
    clubSyncs: [],
    authenticated: false,
    addFavorite: vi.fn(async () => ({ error: null })),
    removeFavorite: vi.fn(async () => ({ error: null })),
    connectTeamToClub: vi.fn(async () => ({ error: null })),
    disconnectTeamFromClub: vi.fn(async () => ({ error: null })),
    shareMatchToClub: vi.fn(async () => ({ error: null })),
  }),
}));

vi.mock("@/features/football/MatchdayEngagement", () => ({
  GoldenBootLeaderboard: () => <div data-testid="golden-boot">Golden Boot leaderboard</div>,
  MatchdayFanPolls: () => <div data-testid="matchday-fan-polls">Matchday fan polls</div>,
  MatchAudioPrompt: () => null,
  MatchReactionLink: () => null,
  TeamFormGuide: () => null,
  useMatchdayForm: () => ({}),
}));

vi.mock("@/features/football/ArenaFixturesTables", () => ({
  ArenaFixturesTables: () => <div data-testid="fixtures-tables">Fixtures and tables</div>,
}));

vi.mock("@/features/arena/ConnectedGames", () => ({
  ConnectedGames: () => <div>Connected games</div>,
}));

vi.mock("@/features/arena/ArenaTournamentHub", () => ({
  ArenaTournamentHub: () => <div data-testid="cups-hub">Cups hub</div>,
}));

describe("Match Center football quick navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Matchday Pulse followed by exactly six named section tiles", () => {
    render(<MatchCenterPage />);

    expect(screen.getByText("Matchday pulse")).toBeInTheDocument();
    const dashboard = screen.getByRole("region", { name: "Football sections" });
    expect(within(dashboard).getAllByRole("button")).toHaveLength(6);

    for (const label of ["Live Scores", "Golden Boot", "News", "Highlights", "Fixtures", "Fan Zone"]) {
      expect(within(dashboard).getByRole("button", { name: `Open ${label}` })).toBeInTheDocument();
    }
  });

  it.each([
    ["Live Scores", "Match ticker"],
    ["Golden Boot", "Golden Boot leaderboard"],
    ["News", "Breaking & transfer news"],
    ["Highlights", "Quick highlights"],
    ["Fixtures", "Fixtures and tables"],
    ["Fan Zone", "Squad discussion"],
  ])("opens the %s group and returns to the football dashboard", (label, expectedContent) => {
    render(<MatchCenterPage />);

    fireEvent.click(screen.getByRole("button", { name: `Open ${label}` }));
    expect(screen.getByRole("button", { name: "Back to Football" })).toBeInTheDocument();
    expect(screen.getByText(expectedContent)).toBeInTheDocument();

    if (label === "Golden Boot") {
      expect(screen.getByTestId("golden-boot")).toBeInTheDocument();
    }
    if (label === "Fixtures") {
      expect(screen.getByTestId("fixtures-tables")).toBeInTheDocument();
    }
    if (label === "Fan Zone") {
      expect(screen.getByTestId("matchday-fan-polls")).toBeInTheDocument();
      expect(screen.getByText("Audio watch-along")).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole("button", { name: "Back to Football" }));
    expect(screen.getByRole("region", { name: "Football sections" })).toBeInTheDocument();
  });

  it("keeps Instant play and Cups separate from the football dashboard", () => {
    render(<MatchCenterPage />);

    fireEvent.click(screen.getByRole("button", { name: "Instant play" }));
    expect(screen.getByText("Play instantly")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Football sections" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cups" }));
    expect(screen.getByTestId("cups-hub")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Football" }));
    expect(screen.getByRole("region", { name: "Football sections" })).toBeInTheDocument();
  });
});
