export type ResourceAccessInput = {
  accessTier: string;
  isEnrolled: boolean;
  isOwner: boolean;
};

export function canAccessAcademyResource({ accessTier, isEnrolled, isOwner }: ResourceAccessInput): boolean {
  if (accessTier !== "enrolled") return false;
  return isEnrolled || isOwner;
}
