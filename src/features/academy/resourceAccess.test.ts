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

import { mapAcademyResourcePreview } from "./resourceAccess";

describe("mapAcademyResourcePreview", () => {
  it("maps only safe metadata and never carries the storage object key", () => {
    const preview = mapAcademyResourcePreview({
      id: "resource-1",
      course_id: "course-1",
      resource_name: "Study guide",
      file_type: "pdf",
      file_size_bytes: 2048,
      access_tier: "enrolled",
      r2_object_key: "private/course-1/secret.pdf",
    });

    expect(preview).toEqual({
      id: "resource-1",
      courseId: "course-1",
      name: "Study guide",
      type: "PDF",
      size: 2048,
      accessTier: "enrolled",
    });
    expect(preview).not.toHaveProperty("key");
    expect(preview).not.toHaveProperty("r2_object_key");
  });
});
