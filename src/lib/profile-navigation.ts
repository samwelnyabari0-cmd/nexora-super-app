const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate a Supabase account UUID before attempting public profile lookup. */
export function isValidProfileUserId(userId: string | null | undefined): boolean {
  return Boolean(userId && UUID_PATTERN.test(userId.trim()));
}

/** Build a public-profile URL only when the selected account has a valid UUID. */
export function profilePathForUser(userId: string | null | undefined): string | null {
  const id = userId?.trim();
  if (!isValidProfileUserId(id)) return null;
  return `/profile/id/${id}`;
}
