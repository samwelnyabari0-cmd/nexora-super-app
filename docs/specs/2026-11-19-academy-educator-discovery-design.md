# Academy Educator Discovery and Saved Learning — Design

## Status
Design approved by the user and committed to the Nexora repository.

## Goal
Add an education-focused discovery experience to Nexora Academy so learners can find instructors and educational creators, inspect their teaching profiles and content, follow them, and save useful learning items.

## Scope

### 1. Academy search modes
- Add two clearly separated modes: **Search Courses** and **Instructors & Educators**.
- Preserve the existing course search and filtering behavior.
- The educator mode searches eligible education profiles by display name, handle, bio, and education skills/specialties.
- Provide quick skill chips, initially including React, WebGL, UI/UX, and Video Editing. Chips should be derived from or match the profile skills data rather than inventing skill records.

### 2. Eligible educator profiles
- Include only profiles whose profile category/account classification explicitly identifies an educational role, such as instructor, educator, teacher, or educational content creator.
- Do not include ordinary Nexora users or unrelated social creators.
- A profile may appear even if it has not published an Academy course, provided it is explicitly classified as an education profile.
- Use existing profile fields where possible (display name, handle, avatar, bio, profile category, account type, interests/settings, and bio links). Confirm the exact stored category values and skills source before implementation; do not infer eligibility from a user's general activity or ordinary posts.
- Respect profile discoverability and privacy settings. Private or non-discoverable profiles must not be exposed through public educator search unless existing product rules explicitly permit it.

### 3. Creator Showcase
- Tapping an educator result opens a focused Showcase profile.
- Show available profile identity information: avatar, display name, handle, bio, and education skills/specialties.
- Show the educator role/category badge. Show a verified badge only if a real verification field or trusted verification source exists.
- Show counts derived from Academy data: published courses, lessons belonging to published courses, and enrolled students. Avoid exposing private learner details.
- Show the educator's published courses, associated lessons, and resources that the current access rules permit the viewer to see.
- Do not display an average rating until a real rating/review data source exists. Do not show fabricated or placeholder ratings.
- For an educator with no published courses, show a clear empty state while retaining their profile and skills.

### 4. Follow educators
- Reuse Nexora's existing user-follow relationship rather than introducing a duplicate follow system.
- Display the current follow state and allow the signed-in learner to follow or unfollow.
- Respect existing follow policies, uniqueness rules, and row-level security. Signed-out users may view eligible public profiles but must be prompted to sign in before following.

### 5. Unified Saved learning
- Extend My Learning → Saved to support four item types: courses, lessons, resources, and educator profiles.
- Provide filters: All Saved, Courses, Lessons, Resources, and Educators (the original request's All Saved/Courses/Resources/Creators filters, with Lessons included as its own useful category).
- One-tap save/unsave controls should be available from relevant course, lesson, resource, and educator surfaces.
- Saved items should persist for the signed-in user across devices using a dedicated, typed database representation with ownership and uniqueness constraints. Do not overload the existing social-post bookmark table.
- Preserve existing saved-course localStorage data during migration/transition; do not silently erase a learner's current saved courses. Define a safe migration/import approach during implementation.
- Enforce access checks when opening saved lessons/resources: saving an item must not grant access to paid, private, or otherwise restricted content.

## Data and architecture direction
- Reuse `profiles`, `edu_courses`, `edu_lessons`, `edu_resources`, and `edu_enrollments` for profile and Academy content data.
- Reuse the existing `follows`/`user_follows` relationship only after verifying which table is canonical and which one current Nexora social features use. Do not write to both.
- Existing saved course state is browser-local (`nexora-academy-saved-courses`). Existing `user_saved_items` is associated with social post bookmarks and should not be repurposed without a verified compatible schema.
- Before implementation, inspect actual profile category values and identify the authoritative source for education skills. If there is no reliable skills field, add a small, explicit education-skills field or use an existing structured profile field; do not parse arbitrary prose as authoritative skills.
- Any new saved-learning table must use UUID user ownership, a constrained item type, an item identifier, timestamps, a uniqueness constraint per user/type/item, RLS restricting rows to their owner, and server/database validation that referenced items exist. Resource access remains governed by existing Academy access rules.

## UX and states
- Include loading, no-results, signed-out, and error states for educator search and saved items.
- Keep the current Academy course discovery experience intact.
- Use concise labels and mobile-friendly layouts.
- Empty educator catalogues should say that the educator has not published Academy courses yet, rather than implying an error.

## Security and privacy
- Search must only return profiles eligible for education discovery and permitted by privacy/discoverability settings.
- Follow and saved-item mutations must be authenticated and owner-scoped.
- Never expose student identities or private enrollment details in public educator statistics.
- A saved reference is not an entitlement; lesson/resource authorization must be rechecked at access time.

## Testing and acceptance criteria
1. Search modes switch independently and existing course search continues to work.
2. Only explicitly education-classified, discoverable profiles appear; ordinary users and unrelated creators do not.
3. Educators with and without published courses can be found when eligible.
4. Name, handle, bio, and supported skill searches return relevant results; skill chips filter correctly.
5. Showcase profile content and counts match underlying published Academy records.
6. No fake verification or ratings are displayed.
7. Follow/unfollow reflects the canonical social follow relationship and persists after refresh.
8. Courses, lessons, resources, and educators can be saved and unsaved; Saved filters return the correct item types.
9. Saved items persist across sessions/devices for authenticated users and cannot be read or changed by another user.
10. Existing locally saved courses are preserved through the transition.
11. Saving restricted content does not bypass enrollment, payment, or resource access checks.
12. Mobile layouts, loading, empty, signed-out, and error states are verified.

## Out of scope
- General-purpose Nexora user discovery.
- Social creator discovery unrelated to education.
- A new ratings/reviews system or verification program.
- Public access to restricted course resources.
- Changes to unrelated Academy or social features.

## Open implementation checks
These are verification tasks, not product decisions: confirm canonical follow table and policies; inspect real profile category values and discoverability semantics; identify the authoritative structured skill source; inspect current Academy UI components and current saved-course behavior before changing them.
