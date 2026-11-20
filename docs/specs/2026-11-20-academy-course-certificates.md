# Academy Course Certificates

## Goal
Issue verifiable completion certificates to learners who finish every published lesson in an Academy course.

## Rules
- A signed-in learner must have an active or completed enrolment.
- The course must be published and contain at least one published lesson.
- Every published lesson must have a matching completed row in edu_lesson_progress for that learner.
- Certificate issuance is performed by a database function that derives the learner from auth.uid(); clients cannot insert or edit certificate rows.
- A unique certificate is issued per learner/course and is idempotent.
- Store a snapshot of learner name, course title, instructor name, issue date, and a high-entropy verification code.
- Public verification returns only those certificate fields and validity; never expose learner email, user ID, or private course data.

## Learner experience
- Completed courses in My Learning show an Issue/View certificate action.
- Learners can view a print-friendly certificate, print or save as PDF, and copy a public verification link.
- If course progress is not complete or enrolment is ineligible, the database rejects issuance.

## Security
- RLS enabled on certificate storage.
- Learners may read only their own certificates.
- No direct client INSERT, UPDATE, or DELETE.
- SECURITY DEFINER RPCs use empty search_path and fully qualified object names.
- Public verification RPC returns a narrowly scoped projection only.

## Out of scope
- Paid enrolment/payment changes.
- Certificate revocation or instructor-issued certificates.
- External accreditation claims.
