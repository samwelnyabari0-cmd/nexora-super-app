import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProfileIdentityHeader } from "@/components/nexora/ProfileIdentityHeader";

describe("ProfileIdentityHeader", () => {
  it("renders the account identity, avatar, counts and caller-provided actions in one shared layout", () => {
    const { container } = render(
      <ProfileIdentityHeader
        className="space-y-4"
        avatar={<img alt="NEXORA account avatar" src="/avatar.png" />}
        identity={<div><h1>Creator name</h1><p>@creator</p></div>}
        counts={<div><span>12 Posts</span><span>34 Followers</span><span>56 Following</span></div>}
      />,
    );

    expect(screen.getByRole("img", { name: "NEXORA account avatar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Creator name" })).toBeInTheDocument();
    expect(screen.getByText("@creator")).toBeInTheDocument();
    expect(screen.getByText("12 Posts")).toBeInTheDocument();
    expect(screen.getByText("34 Followers")).toBeInTheDocument();
    expect(screen.getByText("56 Following")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("space-y-4");
    expect(container.querySelector(".flex.min-w-0.items-center.gap-4")).toBeInTheDocument();
  });
});
