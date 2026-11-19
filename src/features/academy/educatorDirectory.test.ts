import { describe, expect, it } from "vitest";
import {
  filterEducators,
  normalizeEducationSkills,
  type AcademyEducator,
} from "./educatorDirectory";

const educators: AcademyEducator[] = [
  {
    id: "1",
    display_name: "Ada Developer",
    handle: "ada_codes",
    bio: "Building web applications",
    avatar_url: null,
    account_type: "creator",
    profile_category: "education",
    education_skills: ["React", "WebGL"],
  },
  {
    id: "2",
    display_name: "Nia Design",
    handle: "nia.design",
    bio: "Teaching creative design",
    avatar_url: null,
    account_type: "business",
    profile_category: "education",
    education_skills: ["UI/UX", "Video Editing"],
  },
];

describe("normalizeEducationSkills", () => {
  it("trims, deduplicates case-insensitively, and ignores invalid values", () => {
    expect(normalizeEducationSkills([" React ", "react", null, 3, "WebGL"])).toEqual([
      "React",
      "WebGL",
    ]);
  });

  it("limits saved skills to twenty entries and thirty-two characters", () => {
    const values = Array.from({ length: 25 }, (_, index) => "Skill " + index);
    const result = normalizeEducationSkills([...values, "x".repeat(40)]);
    expect(result).toHaveLength(20);
    expect(result.every((skill) => skill.length <= 32)).toBe(true);
  });
});

describe("filterEducators", () => {
  it("searches names, handles, bios, and education skills without case sensitivity", () => {
    expect(filterEducators(educators, "ADA")).toHaveLength(1);
    expect(filterEducators(educators, "@nia.design")[0].id).toBe("2");
    expect(filterEducators(educators, "webgl")[0].id).toBe("1");
    expect(filterEducators(educators, "creative")[0].id).toBe("2");
  });

  it("combines the text query with an exact skill filter", () => {
    expect(filterEducators(educators, "", "ui/ux").map((item) => item.id)).toEqual([
      "2",
    ]);
    expect(filterEducators(educators, "ada", "UI/UX")).toEqual([]);
  });
});
