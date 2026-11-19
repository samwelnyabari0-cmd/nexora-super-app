import { describe, expect, it } from "vitest";
import {
  isValidCourseRating,
  mapCourseRating,
  mapCourseRatingSummary,
} from "./courseRatings";

describe("course rating helpers", () => {
  it("accepts only integer ratings from one to five", () => {
    expect([1, 2, 3, 4, 5].every(isValidCourseRating)).toBe(true);
    expect([0, 6, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "5", null].some(isValidCourseRating)).toBe(false);
  });

  it("maps a course with no aggregate row to an empty summary", () => {
    expect(mapCourseRatingSummary(null)).toEqual({
      averageRating: null,
      ratingCount: 0,
    });
  });

  it("maps the aggregate average and total count", () => {
    expect(mapCourseRatingSummary({ average_rating: 4.25, rating_count: 8 })).toEqual({
      averageRating: 4.25,
      ratingCount: 8,
    });
  });

  it("maps the learner's own course rating without exposing identity", () => {
    expect(mapCourseRating({ course_id: "course-1", rating: 5 })).toEqual({
      courseId: "course-1",
      rating: 5,
    });
  });
});
