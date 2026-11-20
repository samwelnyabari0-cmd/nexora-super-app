# Strict Reels and Videos — implementation plan

## Confirmed product rules
- A Reel is a video with portrait dimensions (height > width) and duration <= 90 seconds.
- A Video is any other video (landscape/square or longer than 90 seconds).
- Images and text-only items remain Posts.
- Collaboration is a separate content type and is not inferred from video orientation.
- Preserve existing Supabase Storage, post engagement RPCs, comments, likes, shares, views, audience rules and account/profile data.

## Implementation
1. Add a constrained `content_type` column to `public.user_media_posts`, plus `aspect_ratio` and `duration_seconds`; backfill from existing type tags and MIME type; add feed indexes. Do not change existing RLS.
2. Add tested upload classification helpers and update the creator upload flow to enforce the 90-second Reel limit, classify video metadata, persist classification/dimensions/duration, and persist the optional cover URL.
3. Add strict database-backed Reels and Videos feed routes. Each query must include an exact `content_type` predicate. Reels use vertical tiles and a full-screen vertical snap viewer; Videos use widescreen cards and a horizontal player with Up Next restricted to videos.
4. Add dedicated Reels and Videos destinations to mobile bottom navigation and desktop navigation.
5. Add strict Posts/Reels/Videos/Collabs filters to Explore and the signed-in user's Profile content. Keep existing interaction actions intact.
6. Add automated tests for classification, duration boundaries, legacy tag mapping, and feed filtering helpers; run CI tests, lint, type checks/build.

## Safety and compatibility
- Canonical creator content table is `user_media_posts`; do not create a parallel `posts` table or use the sample code's `posts` schema.
- Existing rows with explicit Reel tags remain Reels; unclassified legacy videos default to Videos (safe fallback, never silently guess portrait).
- Keep private rows subject to current RLS. Do not broaden public visibility.
- Do not apply production migrations, merge, or deploy until the user approves those steps.
