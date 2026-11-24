const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate a Supabase account UUID before attempting public profile lookup. */
export function isValidProfileUserId(userId: string | null | undefined): boolean {
  return Boolean(userId && UUID_PATTERN.test(userId.trim()));
}

/** Accept only internal account-profile paths as a chat return destination. */
export function isSafeProfileReturnPath(path: string | null | undefined): boolean {
  if (!path || path.startsWith("//") || path.includes("\\\\")) return false;
  if (/^\/profile(?:\/|\?|$)/.test(path)) return true;
  const match = path.match(/^\/u\/([^/?#]+)(?:\?[^#]*)?$/);
  return Boolean(match && isValidProfileUserId(match[1]));
}

/** Build a public-profile URL only when the selected account has a valid UUID. */
export function profilePathForUser(userId: string | null | undefined): string | null {
  const id = userId?.trim();
  if (!isValidProfileUserId(id)) return null;
  return `/u/${id}`;
}
