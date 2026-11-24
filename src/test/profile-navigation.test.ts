import { describe, expect, it } from "vitest";
import { isSafeProfileReturnPath, isValidProfileUserId, profilePathForUser } from "@/lib/profile-navigation";

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


describe("isSafeProfileReturnPath", () => {
  it("allows the exact public profile URL when returning from chat", () => {
    expect(isSafeProfileReturnPath("/u/829cf6ba-6877-41fa-9d7d-303fb437986a")).toBe(true);
    expect(isSafeProfileReturnPath("/u/829cf6ba-6877-41fa-9d7d-303fb437986a?post=post-1")).toBe(true);
    expect(isSafeProfileReturnPath("/profile?handle=creator")).toBe(true);
  });

  it.each(["https://example.com", "//example.com", "/u/not-a-uuid", "/u/829cf6ba-6877-41fa-9d7d", "/explore", null, undefined])(
    "rejects unsafe or unsupported return destinations: %s",
    (path) => expect(isSafeProfileReturnPath(path)).toBe(false),
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
