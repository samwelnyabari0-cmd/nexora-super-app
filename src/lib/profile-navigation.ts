const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Build a public-profile URL only when the selected account has a valid UUID. */
export function profilePathForUser(userId: string | null | undefined): string | null {
  const id = userId?.trim();
  if (!id || !UUID_PATTERN.test(id)) return null;
  return `/profile/id/${id}`;
}
