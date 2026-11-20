# Implementation Plan: Academy Course Certificates

1. Add a migration for private certificate storage, owner-only reads, issue RPC, and public verification RPC.
2. Add client helpers to issue and list the current learner's certificates and verify a public code.
3. Add a print-friendly certificate view and public verification route.
4. Integrate certificate actions into completed My Learning course cards.
5. Add unit tests for certificate code validation, result mapping, and UI states.
6. Add SQL verification for RLS, grants, function ownership/search_path, unique issuance, eligibility checks, and safe public projection.
7. Run Academy tests, targeted lint, and production build; inspect CI and deployment results before merging.

## Acceptance criteria
- No direct client write access to certificate records.
- Incomplete or ineligible learners cannot issue certificates.
- Repeated issuance returns the same certificate.
- Public verification reveals no email or account identifiers.
- Completed learners can print/save and share their certificate.
- Existing Academy enrolment, notes, ratings, and progress behaviour remains unchanged.
