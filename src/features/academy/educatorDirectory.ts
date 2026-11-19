export type AcademyEducator = {
  id: string;
  display_name: string | null;
  handle: string | null;
  bio: string | null;
  avatar_url: string | null;
  account_type: string;
  profile_category: string;
  education_skills: string[];
};

export function normalizeEducationSkills(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") continue;
    const skill = value.trim().replace(/\s+/g, " ").slice(0, 32);
    const key = skill.toLocaleLowerCase();
    if (!skill || seen.has(key)) continue;
    seen.add(key);
    normalized.push(skill);
    if (normalized.length === 20) break;
  }

  return normalized;
}

export function filterEducators(
  educators: AcademyEducator[],
  query: string,
  selectedSkill = "",
): AcademyEducator[] {
  const normalizedQuery = query.trim().replace(/^@/, "").toLocaleLowerCase();
  const normalizedSkill = selectedSkill.trim().toLocaleLowerCase();

  return educators.filter((educator) => {
    const skills = educator.education_skills ?? [];
    const matchesSkill =
      !normalizedSkill ||
      skills.some((skill) => skill.toLocaleLowerCase() === normalizedSkill);

    if (!matchesSkill) return false;
    if (!normalizedQuery) return true;

    const searchable = [
      educator.display_name,
      educator.handle,
      educator.bio,
      ...skills,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();

    return searchable.includes(normalizedQuery);
  });
}
