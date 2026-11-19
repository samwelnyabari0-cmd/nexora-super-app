-- Keep the existing instructor publishing flow compatible during rollout.
-- Legacy course publishing inserts lessons/resources before publishing the
-- parent course. The parent-course visibility policy still prevents learners
-- from accessing these rows until the course itself is published.
-- New Creator Studio duplication flows explicitly set publication_status='draft'.
alter table public.edu_lessons
  alter column publication_status set default 'published';

alter table public.edu_resources
  alter column publication_status set default 'published';
