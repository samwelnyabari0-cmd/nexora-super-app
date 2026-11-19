import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getCourseRatingSummary,
  getMyCourseRating,
  saveCourseRating,
  type CourseRatingSummary,
} from "./courseRatings";

type CourseRatingPanelProps = {
  courseId: string;
  isSignedIn: boolean;
  canRate: boolean;
};

const emptySummary: CourseRatingSummary = {
  averageRating: null,
  ratingCount: 0,
};

export function CourseRatingPanel({
  courseId,
  isSignedIn,
  canRate,
}: CourseRatingPanelProps) {
  const [summary, setSummary] = useState<CourseRatingSummary>(emptySummary);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const loadRating = useCallback(async () => {
    setLoading(true);
    const summaryResult = await getCourseRatingSummary(courseId);
    const myRatingResult = canRate
      ? await getMyCourseRating(courseId)
      : { data: null, error: null };

    setSummary(summaryResult.data ?? emptySummary);
    setSummaryError(summaryResult.error?.message ?? null);
    setMyRating(myRatingResult.data?.rating ?? null);
    setSelectedRating(myRatingResult.data?.rating ?? null);
    setError(summaryResult.error?.message ?? myRatingResult.error?.message ?? null);
    setLoading(false);
  }, [canRate, courseId]);

  useEffect(() => {
    void loadRating();
  }, [loadRating]);

  async function handleSave() {
    if (!canRate || selectedRating === null || saving) return;

    setSaving(true);
    setError(null);
    const result = await saveCourseRating(courseId, selectedRating);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    toast.success("Your course rating was saved.");
    await loadRating();
    setSaving(false);
  }

  return (
    <section
      className="rounded-2xl border bg-card p-4"
      aria-labelledby="course-rating-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="course-rating-heading" className="font-semibold">
            Course rating
          </h3>
          {loading ? (
            <p className="mt-1 text-sm text-muted-foreground">Loading rating…</p>
          ) : summaryError ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Rating summary unavailable.
            </p>
          ) : summary.averageRating === null ? (
            <p className="mt-1 text-sm text-muted-foreground">
              No ratings yet · 0 ratings
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {summary.averageRating.toFixed(1)} / 5
              </span>
              {" · "}
              {summary.ratingCount}{" "}
              {summary.ratingCount === 1 ? "rating" : "ratings"}
            </p>
          )}
        </div>
        {summary.averageRating !== null && (
          <div
            role="img"
            className="flex items-center gap-1"
            aria-label={`Average rating ${summary.averageRating.toFixed(1)} out of 5`}
          >
            {Array.from({ length: 5 }, (_, index) => (
              <Star
                key={index}
                aria-hidden="true"
                className={
                  index < Math.round(summary.averageRating ?? 0)
                    ? "h-4 w-4 fill-amber-400 text-amber-400"
                    : "h-4 w-4 text-muted-foreground"
                }
              />
            ))}
          </div>
        )}
      </div>

      {canRate ? (
        <div className="mt-4">
          <p className="text-sm font-medium">Your rating</p>
          <div
            className="mt-2 flex items-center gap-1"
            role="group"
            aria-label="Choose your course rating"
          >
            {Array.from({ length: 5 }, (_, index) => {
              const value = index + 1;
              const active = selectedRating !== null && value <= selectedRating;
              return (
                <Button
                  key={value}
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Rate ${value} out of 5 stars`}
                  aria-pressed={selectedRating === value}
                  disabled={loading || saving}
                  onClick={() => setSelectedRating(value)}
                  className="h-10 w-10"
                >
                  <Star
                    className={
                      active
                        ? "h-5 w-5 fill-amber-400 text-amber-400"
                        : "h-5 w-5"
                    }
                  />
                </Button>
              );
            })}
            <span className="ml-2 text-sm text-muted-foreground">
              {selectedRating === null ? "Select 1–5 stars" : `${selectedRating} of 5`}
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            className="mt-3"
            disabled={
              loading ||
              saving ||
              selectedRating === null ||
              selectedRating === myRating
            }
            onClick={() => void handleSave()}
          >
            {saving ? "Saving…" : myRating === null ? "Save rating" : "Update rating"}
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {isSignedIn
            ? "Active or completed enrolment is required to rate this course."
            : "Sign in and enrol in this course to leave a rating."}
        </p>
      )}

      {error && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
