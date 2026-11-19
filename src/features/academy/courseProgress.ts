export type ResumeLesson = { id: string; lessonOrder: number };
export type ResumeLessonProgress = {
  completed: boolean;
  lastPositionSeconds: number;
  updatedAt?: string | null;
};

export function getResumeLessonId(
  lessons: ResumeLesson[],
  progress: Record<string, ResumeLessonProgress>,
): string | null {
  return null;
}
