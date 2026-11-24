import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileIdentityHeader } from "@/components/nexora/ProfileIdentityHeader";

const profile = { displayName: "NEXORA Creator", handle: "creator_one", avatarUrl: null };

describe("ProfileIdentityHeader", () => {
  it("renders the shared identity and social counts for a visitor", () => {
    const { container } = render(
      <ProfileIdentityHeader
        profile={profile}
        counts={{ posts: 12, followers: 340, following: 81 }}
        isOwner={false}
        onFollowersClick={() => undefined}
        onFollowingClick={() => undefined}
      />,
    );
    expect(screen.getByText("NEXORA Creator")).toBeInTheDocument();
    expect(screen.getByText("@creator_one")).toBeInTheDocument();
    expect(screen.getByText("Posts")).toBeInTheDocument();
    expect(screen.getByText("Followers")).toBeInTheDocument();
    expect(screen.getByText("Following")).toBeInTheDocument();
    expect(container.querySelector('[data-profile-owner="false"]')).not.toBeNull();
  });

  it("uses the same identity structure for the owner and supports custom actions", () => {
    render(
      <ProfileIdentityHeader
        profile={profile}
        counts={{ posts: 5, followers: 20, following: 9 }}
        isOwner
        actions={<button type="button">Edit Profile</button>}
      />,
    );
    expect(screen.getByText("NEXORA Creator")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Profile" })).toBeInTheDocument();
    expect(document.querySelector('[data-profile-owner="true"]')).not.toBeNull();
  });

  it("keeps identity layout intact when optional profile fields are missing", () => {
    render(
      <ProfileIdentityHeader
        profile={{ displayName: "NEXORA member" }}
        counts={{ followers: 0, following: 0 }}
        isOwner={false}
      />,
    );
    expect(screen.getByText("NEXORA member")).toBeInTheDocument();
    expect(screen.queryByText(/@/)).toBeNull();
    expect(screen.getByText("Followers")).toBeInTheDocument();
    expect(screen.getByText("Following")).toBeInTheDocument();
  });
});
