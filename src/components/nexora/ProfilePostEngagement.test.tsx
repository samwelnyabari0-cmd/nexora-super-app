import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfilePostEngagement } from "./ProfilePostEngagement";

describe("ProfilePostEngagement", () => {
  it("shows Instagram-style engagement actions and counts", () => {
    render(
      <ProfilePostEngagement
        liked={false}
        saved={false}
        reposted={false}
        likes={120}
        comments={8}
        shares={12}
        reposts={3}
        onLike={() => undefined}
        onComment={() => undefined}
        onShare={() => undefined}
        onSave={() => undefined}
        onRepost={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "Like post" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Comment on post" })).toHaveTextContent("8");
    expect(screen.getByRole("button", { name: "Share post" })).toHaveTextContent("12");
    expect(screen.getByRole("button", { name: "Save post" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Repost post" })).toHaveTextContent("3");
  });

  it("reflects active states and invokes the matching post action", () => {
    const actions = {
      like: vi.fn(),
      comment: vi.fn(),
      share: vi.fn(),
      save: vi.fn(),
      repost: vi.fn(),
    };
    render(
      <ProfilePostEngagement
        liked saved reposted
        likes={121}
        comments={9}
        shares={13}
        reposts={4}
        onLike={actions.like}
        onComment={actions.comment}
        onShare={actions.share}
        onSave={actions.save}
        onRepost={actions.repost}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Unlike post" }));
    fireEvent.click(screen.getByRole("button", { name: "Comment on post" }));
    fireEvent.click(screen.getByRole("button", { name: "Share post" }));
    fireEvent.click(screen.getByRole("button", { name: "Unsave post" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove repost" }));

    expect(actions.like).toHaveBeenCalledOnce();
    expect(actions.comment).toHaveBeenCalledOnce();
    expect(actions.share).toHaveBeenCalledOnce();
    expect(actions.save).toHaveBeenCalledOnce();
    expect(actions.repost).toHaveBeenCalledOnce();
  });
});
