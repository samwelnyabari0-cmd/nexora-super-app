import { describe, expect, it } from "vitest";
import { canAccessAcademyResource } from "./resourceAccess";

describe("canAccessAcademyResource", () => {
  it("allows an enrolled learner to download an enrolled resource", () => {
    expect(canAccessAcademyResource({ accessTier: "enrolled", isEnrolled: true, isOwner: false })).toBe(true);
  });

  it("allows the course owner to access their own resource", () => {
    expect(canAccessAcademyResource({ accessTier: "enrolled", isEnrolled: false, isOwner: true })).toBe(true);
  });

  it("keeps enrolled resources locked for visitors who are not enrolled", () => {
    expect(canAccessAcademyResource({ accessTier: "enrolled", isEnrolled: false, isOwner: false })).toBe(false);
  });

  it("does not treat unknown access tiers as public", () => {
    expect(canAccessAcademyResource({ accessTier: "unknown", isEnrolled: true, isOwner: false })).toBe(false);
  });
});
