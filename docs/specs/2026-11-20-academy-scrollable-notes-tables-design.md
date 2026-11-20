# Academy Scrollable Notes Tables — Design

**Date:** 2026-11-20  
**Status:** Approved design; awaiting user review of this document  
**Scope:** Academy learning notes presentation only

## Goal

Keep the Academy course page from growing vertically as learners create more notes. Present course-level notes and lesson-level notes in two separate, fixed-height, internally scrollable tables.

## User-visible behavior

### Course Notes table

- Shows every note whose scope is the current course (course-level notes, without a lesson association).
- Does not include lesson-level notes.
- Displays each note's title, content, last-updated date, and available actions.

### Lesson Notes table

- Shows lesson-level notes from **all lessons in the current course**, not only the currently selected lesson.
- Displays the associated lesson name beside each note so learners can identify where it belongs.
- Does not include course-level notes.
- Displays each note's title, content, last-updated date, and available actions.

### Scrolling and layout

- Each table has its own fixed maximum height of 320px and scrolls internally when its content exceeds that height.
- The table header remains visible while scrolling.
- The two tables scroll independently; adding notes does not continuously increase the page height.
- The layout remains usable on narrow/mobile screens. A horizontally scrollable table wrapper is acceptable where needed; long note content must wrap rather than force the entire page wider.
- The note editor remains outside the scrollable table area.
- Existing loading, empty, sign-in, and access states remain understandable and are not replaced by empty tables.

### Note actions

- Preserve existing create, edit, delete, and delete-confirmation behavior.
- Preserve the current note title/body limits and existing validation.
- Editing or deleting a note acts on that note regardless of whether it is course-level or lesson-level.

## Architecture and data flow

- Reuse the existing LearningNotesPanel and existing notes service rather than introducing a new notes subsystem.
- The course-level view continues to use the course scope (lessonId: null).
- The lesson-level view must request all notes for the selected course without a lesson filter, then distinguish course-level from lesson-level notes in the UI. The lesson table includes only notes with a lesson association.
- Resolve lesson IDs to their lesson names using the course's already-loaded lesson metadata where possible. Do not expose private lesson or note data to other users.
- Do not change database schema, RLS policies, grants, storage, or note ownership rules.
- Preserve existing canUseNotes and sign-in gating.

## Error and edge-case behavior

- If there are no course-level notes, show a course-notes empty state.
- If there are no lesson-level notes across the course, show a lesson-notes empty state.
- If a lesson association cannot be resolved to a name, show a neutral fallback such as “Lesson” rather than failing to render the note.
- Long titles and bodies must not break the table layout.
- Loading and query errors must continue to be represented using the component's established states; no silent conversion of an error into a successful empty result.

## Testing and acceptance criteria

- Verify course-level notes appear only in Course Notes.
- Verify lesson-level notes from multiple lessons appear together in Lesson Notes, each with the correct lesson name.
- Verify a lesson note is visible when a different lesson is selected.
- Verify each table scrolls independently and the header remains visible.
- Verify creating, editing, deleting, and confirming deletion still work for both note scopes.
- Verify empty, loading, signed-out, and ineligible states remain correct.
- Verify narrow-screen layout and long note content do not cause page-wide horizontal overflow.
- Run the focused Academy notes tests, targeted lint, and production build before considering the change complete.

## Out of scope

- Database or security-policy changes.
- Changes to note ownership, eligibility, retention, or limits.
- Search, sorting, filtering, export, or pagination.
- Changes to ratings, course progress, resource previews, or unrelated Academy UI.
