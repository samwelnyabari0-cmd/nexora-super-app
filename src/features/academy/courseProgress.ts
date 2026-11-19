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
  if (lessons.length === 0) return null;

  const inProgress = lessons
    .filter((lesson) => {
      const saved = progress[lesson.id];
      return Boolean(saved && !saved.completed && saved.lastPositionSeconds > 0);
    })
    .sort((left, right) => {
      const leftUpdated = progress[left.id]?.updatedAt ?? "";
      const rightUpdated = progress[right.id]?.updatedAt ?? "";
      return rightUpdated.localeCompare(leftUpdated);
    })[0];

  if (inProgress) return inProgress.id;

  const nextIncomplete = lessons.find((lesson) => !progress[lesson.id]?.completed);
  return nextIncomplete?.id ?? lessons[0].id;
}
