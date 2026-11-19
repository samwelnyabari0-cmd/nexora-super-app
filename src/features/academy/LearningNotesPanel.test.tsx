import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LearningNotesPanel } from "./LearningNotesPanel";
import {
  createLearningNote,
  deleteLearningNote,
  listLearningNotes,
  updateLearningNote,
} from "./learningNotes";

vi.mock("./learningNotes", () => ({
  createLearningNote: vi.fn(),
  deleteLearningNote: vi.fn(),
  listLearningNotes: vi.fn(),
  updateLearningNote: vi.fn(),
  MAX_LEARNING_NOTE_BODY_LENGTH: 5000,
  MAX_LEARNING_NOTE_TITLE_LENGTH: 100,
}));

const listMock = vi.mocked(listLearningNotes);
const createMock = vi.mocked(createLearningNote);
const updateMock = vi.mocked(updateLearningNote);
const deleteMock = vi.mocked(deleteLearningNote);

const note = {
  id: "note-1",
  courseId: "course-1",
  lessonId: null,
  title: "Revision point",
  body: "Review the key concept.",
  createdAt: "2026-11-20T10:00:00.000Z",
  updatedAt: "2026-11-20T10:00:00.000Z",
};

describe("LearningNotesPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue({ data: [], error: null });
    createMock.mockResolvedValue({ data: note, error: null });
    updateMock.mockResolvedValue({ error: null });
    deleteMock.mockResolvedValue({ error: null });
  });

  it("shows a sign-in and enrolment explanation when notes are unavailable", () => {
    render(
      <LearningNotesPanel
        courseId="course-1"
        lessonId={null}
        isSignedIn={false}
        canUseNotes={false}
      />,
    );

    expect(
      screen.getByText("Sign in and enrol in this course to create private notes."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save note" })).not.toBeInTheDocument();
  });

  it("creates multiple notes in the selected course or lesson scope", async () => {
    render(
      <LearningNotesPanel
        courseId="course-1"
        lessonId="lesson-9"
        isSignedIn={true}
        canUseNotes={true}
      />,
    );

    fireEvent.change(screen.getByLabelText("Note title"), { target: { value: "Lesson insight" } });
    fireEvent.change(screen.getByLabelText("Note text"), { target: { value: "Remember this." } });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith({
        courseId: "course-1",
        lessonId: "lesson-9",
        title: "Lesson insight",
        body: "Remember this.",
      });
    });
  });

  it("displays multiple saved notes in the selected scope", async () => {
    listMock.mockResolvedValue({
      data: [
        note,
        { ...note, id: "note-2", title: "Second note", body: "Another thought." },
      ],
      error: null,
    });

    render(
      <LearningNotesPanel
        courseId="course-1"
        lessonId={null}
        isSignedIn={true}
        canUseNotes={true}
      />,
    );

    expect(await screen.findByText("Revision point")).toBeInTheDocument();
    expect(screen.getByText("Second note")).toBeInTheDocument();
    expect(screen.getByText("2 notes")).toBeInTheDocument();
  });

  it("allows a learner to edit an existing note", async () => {
    listMock.mockResolvedValue({ data: [note], error: null });

    render(<LearningNotesPanel courseId="course-1" lessonId={null} isSignedIn={true} canUseNotes={true} />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit Revision point" }));
    fireEvent.change(screen.getByLabelText("Note title"), { target: { value: "Updated title" } });
    fireEvent.click(screen.getByRole("button", { name: "Update note" }));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith("note-1", {
        title: "Updated title",
        body: "Review the key concept.",
      });
    });
  });

  it("requires confirmation before deleting a note", async () => {
    listMock.mockResolvedValue({ data: [note], error: null });

    render(<LearningNotesPanel courseId="course-1" lessonId={null} isSignedIn={true} canUseNotes={true} />);

    fireEvent.click(await screen.findByRole("button", { name: "Delete Revision point" }));
    expect(deleteMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith("note-1"));
  });
});
