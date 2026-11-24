import { describe, expect, it } from "vitest";
import { isValidProfileUserId, profilePathForUser } from "@/lib/profile-navigation";

describe("profilePathForUser", () => {
  it("uses the exact account UUID in the canonical profile route", () => {
    const id = "00000000-0000-0000-0000-000000000001";
    expect(profilePathForUser(id)).toBe(`/u/${id}`);
  });

  it.each([null, undefined, "", "   ", "someone", "not-a-uuid"])(
    "does not create a profile link for missing or invalid identity: %s",
    (id) => expect(profilePathForUser(id)).toBeNull(),
  );
});


describe("isValidProfileUserId", () => {
  it("accepts canonical UUIDs without changing their supplied case", () => {
    expect(isValidProfileUserId("829cf6ba-6877-41fa-9d7d-303fb437986a")).toBe(true);
    expect(isValidProfileUserId("829CF6BA-6877-41FA-9D7D-303FB437986A")).toBe(true);
  });

  it.each([null, undefined, "", " ", "nexoracreators", "829cf6ba-6877-41fa-9d7d"])("rejects invalid profile IDs: %s", (value) => {
    expect(isValidProfileUserId(value)).toBe(false);
  });
});
