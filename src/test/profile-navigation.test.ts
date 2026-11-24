import { describe, expect, it } from "vitest";

import { profilePathForUser } from "@/lib/profile-navigation";

describe("profilePathForUser", () => {
  it("builds the canonical route with the exact account UUID", () => {
    const userId = "00000000-0000-4000-8000-000000000001";
    expect(profilePathForUser(userId)).toBe(`/profile/id/${userId}`);
  });

  it.each([null, undefined, "", "not-a-uuid", "00000000-0000-0000-0000-000000000001"])(
    "does not create a profile link for an invalid identity: %s",
    (userId) => {
      expect(profilePathForUser(userId)).toBeNull();
    },
  );
});
