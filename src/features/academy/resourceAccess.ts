export type ResourceAccessInput = {
  accessTier: string;
  isEnrolled: boolean;
  isOwner: boolean;
};

export function canAccessAcademyResource({ accessTier, isEnrolled, isOwner }: ResourceAccessInput): boolean {
  if (accessTier !== "enrolled") return false;
  return isEnrolled || isOwner;
}

export type AcademyResourcePreviewRow = {
  id: string;
  course_id: string;
  resource_name: string;
  file_type: string | null;
  file_size_bytes: number | string | null;
  access_tier: string | null;
};

export function mapAcademyResourcePreview(row: AcademyResourcePreviewRow) {
  return {
    id: row.id,
    courseId: row.course_id,
    name: row.resource_name,
    type: String(row.file_type ?? "FILE").toUpperCase(),
    size: Number(row.file_size_bytes ?? 0),
    accessTier: String(row.access_tier ?? "enrolled"),
  };
}
