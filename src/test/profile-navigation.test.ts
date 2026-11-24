import { describe, expect, it } from "vitest";
import { profilePathForUser } from "@/lib/profile-navigation";

describe("profilePathForUser", () => {
  it("uses the exact account UUID in the canonical profile route", () => {
    const id = "00000000-0000-0000-0000-000000000001";
    expect(profilePathForUser(id)).toBe(`/profile/id/${id}`);
  });

  it.each([null, undefined, "", "   ", "someone", "not-a-uuid"])(
    "does not create a profile link for missing or invalid identity: %s",
    (id) => expect(profilePathForUser(id)).toBeNull(),
  );
});
