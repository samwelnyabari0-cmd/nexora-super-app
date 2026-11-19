import { describe, expect, it } from "vitest";
import {
  MAX_LEARNING_NOTE_BODY_LENGTH,
  MAX_LEARNING_NOTE_TITLE_LENGTH,
  mapLearningNote,
  validateLearningNoteDraft,
} from "./learningNotes";

describe("learning note helpers", () => {
  it("rejects a blank title or body after trimming", () => {
    expect(
      validateLearningNoteDraft({ title: "  ", body: "A note" }),
    ).toBe("Add a title for this note.");
    expect(
      validateLearningNoteDraft({ title: "A title", body: " \n " }),
    ).toBe("Write something in your note.");
  });

  it("enforces the approved title and body limits", () => {
    expect(MAX_LEARNING_NOTE_TITLE_LENGTH).toBe(100);
    expect(MAX_LEARNING_NOTE_BODY_LENGTH).toBe(5000);
    expect(validateLearningNoteDraft({
      title: "x".repeat(100),
      body: "y".repeat(5000),
    })).toBeNull();
    expect(validateLearningNoteDraft({
      title: "x".repeat(101),
      body: "A note",
    })).toBe("Title must be 100 characters or fewer.");
    expect(validateLearningNoteDraft({
      title: "A title",
      body: "y".repeat(5001),
    })).toBe("Note must be 5,000 characters or fewer.");
  });

  it("counts Unicode characters consistently with the database", () => {
    expect(validateLearningNoteDraft({
      title: "😀".repeat(100),
      body: "😀".repeat(5000),
    })).toBeNull();
    expect(validateLearningNoteDraft({
      title: "😀".repeat(101),
      body: "A note",
    })).toBe("Title must be 100 characters or fewer.");
  });

  it("maps course and lesson notes, including a null lesson reference", () => {
    expect(mapLearningNote({
      id: "note-1",
      course_id: "course-1",
      lesson_id: null,
      title: "Course note",
      body: "Remember this",
      created_at: "2026-11-20T10:00:00.000Z",
      updated_at: "2026-11-20T10:05:00.000Z",
      student_id: "student-1",
    })).toEqual({
      id: "note-1",
      courseId: "course-1",
      lessonId: null,
      title: "Course note",
      body: "Remember this",
      createdAt: "2026-11-20T10:00:00.000Z",
      updatedAt: "2026-11-20T10:05:00.000Z",
    });
  });
});
