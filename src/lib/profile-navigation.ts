const USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Build a canonical profile URL only when a real Supabase account UUID is available.
 * This helper intentionally never falls back to the signed-in user's /profile route.
 */
export function profilePathForUser(userId: string | null | undefined): string | null {
  if (typeof userId !== "string" || !USER_ID_PATTERN.test(userId)) return null;
  return `/profile/id/${userId}`;
}
