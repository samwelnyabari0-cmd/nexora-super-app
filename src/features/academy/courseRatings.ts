import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type CourseRatingSummary = {
  averageRating: number | null;
  ratingCount: number;
};

export type CourseRating = {
  courseId: string;
  rating: number;
};

type CourseRatingSummaryRow = Pick<
  Tables<"edu_course_rating_summaries">,
  "average_rating" | "rating_count"
>;
type CourseRatingRow = Pick<Tables<"edu_course_ratings">, "course_id" | "rating">;

function toError(error: { message: string } | null): Error | null {
  return error ? new Error(error.message) : null;
}

export function isValidCourseRating(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function mapCourseRatingSummary(
  row: CourseRatingSummaryRow | null | undefined,
): CourseRatingSummary {
  if (!row) return { averageRating: null, ratingCount: 0 };

  const averageRating = Number(row.average_rating);
  const ratingCount = Number(row.rating_count);

  return {
    averageRating: Number.isFinite(averageRating) ? averageRating : null,
    ratingCount: Number.isFinite(ratingCount) && ratingCount >= 0 ? ratingCount : 0,
  };
}

export function mapCourseRating(row: CourseRatingRow): CourseRating {
  return {
    courseId: row.course_id,
    rating: Number(row.rating),
  };
}

export async function getCourseRatingSummary(
  courseId: string,
): Promise<{ data: CourseRatingSummary | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("edu_course_rating_summaries")
    .select("average_rating, rating_count")
    .eq("course_id", courseId)
    .maybeSingle();

  if (error) return { data: null, error: toError(error) };
  return { data: mapCourseRatingSummary(data), error: null };
}

export async function getMyCourseRating(
  courseId: string,
): Promise<{ data: CourseRating | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("edu_course_ratings")
    .select("course_id, rating")
    .eq("course_id", courseId)
    .maybeSingle();

  if (error) return { data: null, error: toError(error) };
  return { data: data ? mapCourseRating(data) : null, error: null };
}

export async function saveCourseRating(
  courseId: string,
  rating: number,
): Promise<{ error: Error | null }> {
  if (!isValidCourseRating(rating)) {
    return { error: new Error("Choose a rating from 1 to 5 stars.") };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) return { error: toError(authError) };
  if (!authData.user) return { error: new Error("Sign in to rate this course.") };

  const { data: existing, error: lookupError } = await supabase
    .from("edu_course_ratings")
    .select("id")
    .eq("course_id", courseId)
    .maybeSingle();

  if (lookupError) return { error: toError(lookupError) };

  if (existing) {
    const { data, error } = await supabase
      .from("edu_course_ratings")
      .update({ rating })
      .eq("id", existing.id)
      .select("id")
      .maybeSingle();

    if (error) return { error: toError(error) };
    return data
      ? { error: null }
      : { error: new Error("You can update your rating only while enrolled in this course.") };
  }

  const { error: insertError } = await supabase
    .from("edu_course_ratings")
    .insert({ course_id: courseId, student_id: authData.user.id, rating });

  if (!insertError) return { error: null };

  // If two save attempts race, retry as an update. RLS still verifies the
  // current learner and enrolment before allowing the update.
  if ((insertError as { code?: string }).code === "23505") {
    const { data, error } = await supabase
      .from("edu_course_ratings")
      .update({ rating })
      .eq("course_id", courseId)
      .eq("student_id", authData.user.id)
      .select("id")
      .maybeSingle();

    if (error) return { error: toError(error) };
    return data
      ? { error: null }
      : { error: new Error("You can update your rating only while enrolled in this course.") };
  }

  return { error: toError(insertError) };
}
