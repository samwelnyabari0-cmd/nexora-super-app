import { describe, expect, it } from "vitest";
import { getResumeLessonId } from "./courseProgress";

const lessons = [
  { id: "lesson-1", lessonOrder: 1 },
  { id: "lesson-2", lessonOrder: 2 },
  { id: "lesson-3", lessonOrder: 3 },
];

describe("getResumeLessonId", () => {
  it("resumes the most recently watched unfinished lesson", () => {
    expect(getResumeLessonId(lessons, {
      "lesson-1": { completed: true, lastPositionSeconds: 120, updatedAt: "2026-11-18T10:00:00Z" },
      "lesson-2": { completed: false, lastPositionSeconds: 45, updatedAt: "2026-11-18T11:00:00Z" },
      "lesson-3": { completed: false, lastPositionSeconds: 30, updatedAt: "2026-11-18T10:30:00Z" },
    })).toBe("lesson-2");
  });

  it("starts at the first unfinished lesson when none has a saved position", () => {
    expect(getResumeLessonId(lessons, {
      "lesson-1": { completed: true, lastPositionSeconds: 0 },
    })).toBe("lesson-2");
  });

  it("opens the first lesson for review when the course is complete", () => {
    expect(getResumeLessonId(lessons, {
      "lesson-1": { completed: true, lastPositionSeconds: 120 },
      "lesson-2": { completed: true, lastPositionSeconds: 240 },
      "lesson-3": { completed: true, lastPositionSeconds: 180 },
    })).toBe("lesson-1");
  });

  it("returns null when a course has no lessons", () => {
    expect(getResumeLessonId([], {})).toBeNull();
  });
});
