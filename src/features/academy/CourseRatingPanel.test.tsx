import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CourseRatingPanel } from "./CourseRatingPanel";
import { getCourseRatingSummary, getMyCourseRating, saveCourseRating } from "./courseRatings";

vi.mock("./courseRatings", () => ({
  getCourseRatingSummary: vi.fn(),
  getMyCourseRating: vi.fn(),
  saveCourseRating: vi.fn(),
}));

const summaryMock = vi.mocked(getCourseRatingSummary);
const myRatingMock = vi.mocked(getMyCourseRating);
const saveMock = vi.mocked(saveCourseRating);

describe("CourseRatingPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    summaryMock.mockResolvedValue({ data: { averageRating: null, ratingCount: 0 }, error: null });
    myRatingMock.mockResolvedValue({ data: null, error: null });
    saveMock.mockResolvedValue({ error: null });
  });

  it("shows the empty state when a course has no ratings", async () => {
    render(<CourseRatingPanel courseId="course-1" isSignedIn={false} canRate={false} />);

    expect(await screen.findByText("No ratings yet · 0 ratings")).toBeInTheDocument();
    expect(screen.getByText("Sign in and enrol in this course to leave a rating.")).toBeInTheDocument();
  });

  it("lets an eligible learner save a selected rating", async () => {
    render(<CourseRatingPanel courseId="course-1" isSignedIn={true} canRate={true} />);

    fireEvent.click(await screen.findByRole("button", { name: "Rate 5 out of 5 stars" }));
    fireEvent.click(screen.getByRole("button", { name: "Save rating" }));

    await waitFor(() => expect(saveMock).toHaveBeenCalledWith("course-1", 5));
  });

  it("shows the aggregate average and count without individual rater details", async () => {
    summaryMock.mockResolvedValue({ data: { averageRating: 4.5, ratingCount: 12 }, error: null });

    render(<CourseRatingPanel courseId="course-1" isSignedIn={false} canRate={false} />);

    expect(await screen.findByText("4.5 / 5")).toBeInTheDocument();
    expect(screen.getByText("12 ratings")).toBeInTheDocument();
    expect(screen.queryByText(/student|learner id/i)).not.toBeInTheDocument();
  });

  it("does not render an enabled rating control for an ineligible learner", async () => {
    render(<CourseRatingPanel courseId="course-1" isSignedIn={true} canRate={false} />);

    expect(await screen.findByText(/Enrol in this course to rate it/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Rate [1-5] out of 5 stars/ })).not.toBeInTheDocument();
    expect(myRatingMock).not.toHaveBeenCalled();
  });
});
