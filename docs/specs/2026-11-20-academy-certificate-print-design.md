# Academy Certificate Print Design

## Goal
Improve the existing Nexora Academy course certificate so it prints as a complete, polished, single-page A4 landscape document and consistently displays the learner's real profile name.

## Approved design
- Use the user-provided Nexora emblem (blue/purple gradient mark on black) as the certificate's brand emblem.
- Use a coordinated blue, purple, and restrained metallic-gold visual palette.
- Keep the certificate in A4 landscape and fit all certificate content onto one printed page.
- Give the learner name prominent central placement, followed by course title, instructor, and issue/completion date.
- Add a circular “NEXORA ACADEMY — VERIFIED” stamp.
- Add a Nexora-styled signature mark at the bottom, clearly presented as a brand/signature mark rather than a fabricated handwritten person's signature.
- Include the unique verification code and a scannable/link-based public verification route.
- Hide site navigation, controls, and action buttons in print output; retain print and Save as PDF through the browser's print flow.

## Learner-name integrity
- Certificate issuance must require a non-empty, trimmed learner profile name.
- Do not issue a new certificate with a generic fallback such as “Learner”.
- Resolve the authoritative learner name from the existing Nexora profile data and keep the server-side issuance function authoritative.
- If the name is missing, return a clear actionable error directing the learner to complete their profile before issuing.
- Existing certificate snapshots are not silently rewritten by this change. Any correction to an already-issued certificate requires a separately reviewed process.

## Scope and constraints
- Keep the existing one-certificate-per-learner/course rule and unique verification code.
- Preserve existing enrolment and lesson-completion eligibility checks.
- Preserve public verification's minimal data exposure; do not expose email addresses, account IDs, or private profile data.
- Do not weaken RLS, grants, or storage protections.
- No payment, enrolment, or course-access changes.
- Deploy directly to production from the feature branch after checks, as previously requested; do not merge into `main` without separate explicit approval.

## Implementation areas
- `src/routes/certificate.$code.tsx`: certificate composition and print-specific layout/CSS.
- `src/features/academy/CourseCertificatePanel.tsx`: clear missing-name feedback and issuance UX if needed.
- `src/features/academy/courseCertificates.ts` and tests: profile-name/issuance error handling as appropriate.
- Supabase migration: update the secure issuance function to validate the authoritative profile name before insert; avoid changing existing certificate rows.
- SQL verification: confirm missing-name issuance is rejected, valid-name issuance succeeds, and existing RLS/verification protections remain intact.

## Acceptance criteria
1. Browser print preview produces exactly one A4 landscape page with no clipped certificate content.
2. The Nexora emblem and matching Academy verification stamp/signature mark appear in print and PDF output.
3. The learner's full profile name is prominently displayed.
4. A missing/blank profile name prevents issuance and gives a clear next step.
5. Existing certificates remain unchanged and verifiable.
6. Verification page continues to expose only the existing approved public certificate fields.
7. Relevant unit tests, SQL security/behavior checks, lint, and production build pass before deployment.
