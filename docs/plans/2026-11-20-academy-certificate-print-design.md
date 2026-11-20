# Implementation Plan: Academy Certificate Print Design

1. Update the issuance RPC to read the learner's canonical `profiles.display_name` (with auth metadata fallback) and reject blank names; preserve existing issued certificate snapshots.
2. Update the certificate panel to check the saved profile display name before enabling issuance and direct learners without a name to Profile Settings.
3. Redesign the public certificate page as a single A4 landscape print sheet with controlled print dimensions, navy/gold framing, a Nexora gradient emblem, a decorative Nexora signature mark, verification seal, and visible verification code.
4. Keep interactive controls and navigation out of print output; preserve public verification fields and URL.
5. Add unit coverage for learner-name validation and certificate mapping.
6. Run the full Academy CI workflow (tests, targeted lint, production build), inspect the PR checks, apply and verify the narrowly scoped SQL function update, then merge PR #49 and verify the production deployment.

## Acceptance criteria
- A certificate is printed on one A4 landscape page without clipped or split content.
- The learner's actual profile display name is prominent.
- No new certificate can be issued with a blank or generic learner name.
- Existing issued certificate snapshots and verification codes are not silently changed.
- The Nexora signature-style mark and verified stamp are decorative branding, not a claim of a handwritten legal signature.
- Public verification continues to expose only the existing certificate fields.
- Existing enrolment, course completion, and private certificate access rules remain unchanged.
