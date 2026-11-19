export type PublicationStatus = "draft" | "published" | "archived";

export type PublicationSnapshot = {
  publication_status: PublicationStatus;
  published_at: string | null;
  last_published_at?: string | null;
};

export type PublicationTransition = {
  publication_status: PublicationStatus;
  published_at: string | null;
  last_published_at: string | null;
};

export type ContentDeletionEligibility = {
  eligible: boolean;
  eligibleAt: string | null;
  remainingMs: number | null;
};

export const ACADEMY_PUBLICATION_RETENTION_DAYS = 30;
export const ACADEMY_PUBLICATION_RETENTION_MS =
  ACADEMY_PUBLICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/**
 * Mirrors the database deletion window for display purposes.
 * The database trigger remains the authoritative enforcement boundary.
 */
export function getContentDeletionEligibility(
  content: Pick<PublicationSnapshot, "publication_status" | "published_at">,
  now: Date = new Date(),
): ContentDeletionEligibility {
  if (content.publication_status !== "published") {
    return { eligible: true, eligibleAt: null, remainingMs: 0 };
  }

  if (!content.published_at) {
    return { eligible: false, eligibleAt: null, remainingMs: null };
  }

  const publishedAtMs = Date.parse(content.published_at);
  if (!Number.isFinite(publishedAtMs)) {
    return { eligible: false, eligibleAt: null, remainingMs: null };
  }

  const eligibleAtMs = publishedAtMs + ACADEMY_PUBLICATION_RETENTION_MS;
  const remainingMs = Math.max(0, eligibleAtMs - now.getTime());

  return {
    eligible: remainingMs === 0,
    eligibleAt: new Date(eligibleAtMs).toISOString(),
    remainingMs,
  };
}

/**
 * Produces the timestamp changes for one independent content item.
 * Republishing always starts a new retention period.
 */
export function buildPublicationTransition(
  current: PublicationSnapshot,
  nextStatus: PublicationStatus,
  publishedAt: string = new Date().toISOString(),
): PublicationTransition {
  const lastPublishedAt = current.last_published_at ?? null;

  if (current.publication_status === nextStatus) {
    return {
      publication_status: current.publication_status,
      published_at: current.published_at,
      last_published_at: lastPublishedAt,
    };
  }

  if (nextStatus === "published") {
    return {
      publication_status: "published",
      published_at: publishedAt,
      last_published_at: publishedAt,
    };
  }

  return {
    publication_status: nextStatus,
    published_at: null,
    last_published_at: lastPublishedAt,
  };
}
