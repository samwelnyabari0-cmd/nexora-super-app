import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConnectedGames } from "./ConnectedGames";
import type { ConnectedGame } from "./connected-games";

const games: ConnectedGame[] = [
  {
    id: "racer",
    title: "Neon Racer",
    description: "Fast arcade racing.",
    category: "racing",
    provider: "Arcade Studio",
    thumbnailUrl: "https://cdn.example.com/racer.webp",
    gameUrl: "https://games.example.com/racer",
    mode: "embed",
    embedUrl: "https://play.example.com/racer",
    embedOrigin: "https://play.example.com",
    approved: true,
  },
  {
    id: "puzzle",
    title: "Puzzle Garden",
    description: "A relaxing puzzle.",
    category: "puzzle",
    provider: "Puzzle House",
    thumbnailUrl: "https://cdn.example.com/puzzle.webp",
    gameUrl: "https://games.example.com/puzzle",
    mode: "external",
    approved: true,
  },
  {
    id: "unreviewed",
    title: "Unreviewed Game",
    description: "Not approved.",
    category: "arcade",
    provider: "Unknown",
    thumbnailUrl: "https://cdn.example.com/unreviewed.webp",
    gameUrl: "https://games.example.com/unreviewed",
    mode: "external",
    approved: false,
  },
];

describe("ConnectedGames", () => {
  it("shows a clear empty state when no reviewed games are available", () => {
    render(<ConnectedGames games={[]} />);
    expect(screen.getByRole("heading", { name: "Connected Games" })).toBeInTheDocument();
    expect(screen.getByText("More games are coming")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Play on website/ })).not.toBeInTheDocument();
  });

  it("hides unapproved games and combines category and text search filters", () => {
    render(<ConnectedGames games={games} />);
    expect(screen.getByText("Neon Racer")).toBeInTheDocument();
    expect(screen.getByText("Puzzle Garden")).toBeInTheDocument();
    expect(screen.queryByText("Unreviewed Game")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Racing" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search connected games" }), {
      target: { value: "neon" },
    });
    expect(screen.getByText("Neon Racer")).toBeInTheDocument();
    expect(screen.queryByText("Puzzle Garden")).not.toBeInTheDocument();
  });

  it("loads an approved game only after the user chooses Play in Nexora", () => {
    render(<ConnectedGames games={games} />);
    expect(screen.queryByTitle("Neon Racer by Arcade Studio")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Play in Nexora" }));
    const frame = screen.getByTitle("Neon Racer by Arcade Studio");
    expect(frame).toHaveAttribute("src", "https://play.example.com/racer");
    expect(frame).toHaveAttribute("sandbox", "allow-scripts");
    expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(frame).toHaveAttribute("allow", "");
  });

  it("opens external-only games with safe new-context attributes", () => {
    render(<ConnectedGames games={games} />);
    const link = screen.getByRole("link", { name: /Play on website/ });
    expect(link).toHaveAttribute("href", "https://games.example.com/puzzle");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  it("returns to the catalogue with search and category filters preserved", () => {
    render(<ConnectedGames games={games} />);
    fireEvent.click(screen.getByRole("button", { name: "Racing" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search connected games" }), {
      target: { value: "neon" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Play in Nexora" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to games" }));
    expect(screen.getByRole("button", { name: "Racing" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("textbox", { name: "Search connected games" })).toHaveValue("neon");
    expect(screen.getByText("Neon Racer")).toBeInTheDocument();
  });

  it("does not render an outbound link for an unsafe publisher URL", () => {
    const unsafeGame = { ...games[1], gameUrl: "javascript:alert(1)" };
    render(<ConnectedGames games={[unsafeGame]} />);
    expect(screen.queryByRole("link", { name: /Play on website/ })).not.toBeInTheDocument();
    expect(screen.getByText("Publisher link unavailable.")).toBeInTheDocument();
  });
});
