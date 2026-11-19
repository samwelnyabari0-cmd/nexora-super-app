import { describe, expect, it } from "vitest";
import {
  buildPublicationTransition,
  getContentDeletionEligibility,
  type PublicationStatus,
} from "./creatorContent";

describe("getContentDeletionEligibility", () => {
  const now = new Date("2026-11-19T10:00:00.000Z");

  it.each(["draft", "archived"] as PublicationStatus[])(
    "allows immediate deletion for %s content",
    (publication_status) => {
      expect(
        getContentDeletionEligibility(
          { publication_status, published_at: null },
          now,
        ),
      ).toMatchObject({ eligible: true, eligibleAt: null, remainingMs: 0 });
    },
  );

  it("blocks deletion before the current publication cycle reaches 30 days", () => {
    expect(
      getContentDeletionEligibility(
        {
          publication_status: "published",
          published_at: "2026-10-20T10:00:00.001Z",
        },
        now,
      ),
    ).toMatchObject({
      eligible: false,
      eligibleAt: "2026-11-19T10:00:00.001Z",
      remainingMs: 1,
    });
  });

  it("allows deletion exactly 30 days after the current publication cycle began", () => {
    expect(
      getContentDeletionEligibility(
        {
          publication_status: "published",
          published_at: "2026-10-20T10:00:00.000Z",
        },
        now,
      ),
    ).toMatchObject({
      eligible: true,
      eligibleAt: "2026-11-19T10:00:00.000Z",
      remainingMs: 0,
    });
  });

  it("fails closed when a published item has no valid publication timestamp", () => {
    expect(
      getContentDeletionEligibility(
        { publication_status: "published", published_at: null },
        now,
      ).eligible,
    ).toBe(false);
    expect(
      getContentDeletionEligibility(
        { publication_status: "published", published_at: "not-a-date" },
        now,
      ).eligible,
    ).toBe(false);
  });
});

describe("buildPublicationTransition", () => {
  it("clears the active publication timestamp when content is unpublished", () => {
    expect(
      buildPublicationTransition(
        {
          publication_status: "published",
          published_at: "2026-10-01T00:00:00.000Z",
          last_published_at: "2026-10-01T00:00:00.000Z",
        },
        "archived",
        "2026-11-19T10:00:00.000Z",
      ),
    ).toEqual({
      publication_status: "archived",
      published_at: null,
      last_published_at: "2026-10-01T00:00:00.000Z",
    });
  });

  it("starts a fresh 30-day cycle when previously published content is republished", () => {
    expect(
      buildPublicationTransition(
        {
          publication_status: "draft",
          published_at: null,
          last_published_at: "2026-10-01T00:00:00.000Z",
        },
        "published",
        "2026-11-19T10:00:00.000Z",
      ),
    ).toEqual({
      publication_status: "published",
      published_at: "2026-11-19T10:00:00.000Z",
      last_published_at: "2026-11-19T10:00:00.000Z",
    });
  });

  it("does not reset the publication date when already published", () => {
    const current = {
      publication_status: "published" as const,
      published_at: "2026-10-01T00:00:00.000Z",
      last_published_at: "2026-10-01T00:00:00.000Z",
    };
    expect(
      buildPublicationTransition(
        current,
        "published",
        "2026-11-19T10:00:00.000Z",
      ),
    ).toEqual(current);
  });
});
