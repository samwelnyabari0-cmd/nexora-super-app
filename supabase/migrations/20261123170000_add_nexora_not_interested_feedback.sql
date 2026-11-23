CREATE TABLE IF NOT EXISTS public.user_media_post_not_interested (
  post_id uuid NOT NULL REFERENCES public.user_media_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE public.user_media_post_not_interested ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read their own not interested feedback" ON public.user_media_post_not_interested;
CREATE POLICY "Users can read their own not interested feedback"
ON public.user_media_post_not_interested
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.mark_nexora_not_interested(p_post_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_pillar public.content_pillar;
  v_inserted uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT p.pillar INTO v_pillar
  FROM public.user_media_posts p
  WHERE p.id = p_post_id AND (p.audience = 'public' OR p.user_id = v_user_id);
  IF v_pillar IS NULL THEN RAISE EXCEPTION 'Post is not available for this feedback'; END IF;

  INSERT INTO public.user_media_post_not_interested(post_id, user_id)
  VALUES (p_post_id, v_user_id)
  ON CONFLICT DO NOTHING
  RETURNING post_id INTO v_inserted;
  IF v_inserted IS NULL THEN RETURN false; END IF;

  INSERT INTO public.user_pillar_affinity(user_id, pillar, weight, updated_at)
  VALUES (v_user_id, v_pillar, 0.80, now())
  ON CONFLICT (user_id, pillar) DO UPDATE
  SET weight = greatest(0.50, public.user_pillar_affinity.weight - 0.20),
      updated_at = now();
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_nexora_not_interested(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_nexora_not_interested(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_balanced_nexora_feed(p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
RETURNS TABLE (
  id uuid, user_id uuid, caption text, media_url text, media_type varchar, audience text, tags text[],
  content_type text, aspect_ratio text, framing_aspect_ratio text, focal_x double precision, focal_y double precision,
  zoom double precision, dominant_color text, duration_seconds integer, thumbnail_url text,
  media_storage_provider text, media_storage_key text, thumbnail_storage_provider text, thumbnail_storage_key text,
  created_at timestamptz, like_count integer, share_count integer, repost_count integer, comment_count integer,
  view_count integer, pillar public.content_pillar, feed_score numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
WITH user_weights AS (
  SELECT pillar, weight FROM public.user_pillar_affinity WHERE user_id = auth.uid()
),
post_signals AS (
  SELECT p.*, coalesce(s.saves_count, 0)::numeric AS saves_count
  FROM public.user_media_posts p
  LEFT JOIN LATERAL (
    SELECT count(*) AS saves_count FROM public.user_media_post_bookmarks b WHERE b.post_id = p.id
  ) s ON true
  WHERE p.created_at > now() - interval '14 days'
    AND (p.audience = 'public' OR p.user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.user_media_post_not_interested ni
      WHERE ni.post_id = p.id AND ni.user_id = auth.uid()
    )
),
scored_posts AS (
  SELECT p.*,
    ((CASE p.pillar
      WHEN 'education' THEN (p.like_count * 1.0 + p.saves_count * 4.0 + p.completion_count * 3.0)
      WHEN 'football' THEN (p.like_count * 1.5 + p.comment_count * 3.0)
      ELSE (p.like_count * 1.0 + p.comment_count * 2.0 + p.completion_count * 1.5)
    END + 10.0) * coalesce(uw.weight, 1.0))
    / power(extract(epoch FROM (now() - p.created_at)) / 3600.0 + 2.0,
      CASE WHEN p.pillar = 'football' THEN 1.6 ELSE 1.2 END) AS feed_score
  FROM post_signals p LEFT JOIN user_weights uw ON uw.pillar = p.pillar
),
ranked AS (
  SELECT s.*, row_number() OVER (PARTITION BY s.pillar ORDER BY s.feed_score DESC, s.created_at DESC, s.id) AS pillar_rank
  FROM scored_posts s
),
slotted AS (
  SELECT r.*,
    CASE r.pillar
      WHEN 'comedy' THEN ((r.pillar_rank - 1) / 2) * 6 + CASE WHEN r.pillar_rank % 2 = 1 THEN 1 ELSE 5 END
      WHEN 'football' THEN (r.pillar_rank - 1) * 6 + 2
      WHEN 'education' THEN (r.pillar_rank - 1) * 6 + 3
      WHEN 'gaming' THEN (r.pillar_rank - 1) * 6 + 4
      WHEN 'hustle' THEN (r.pillar_rank - 1) * 6 + 6
    END AS global_slot
  FROM ranked r
)
SELECT s.id, s.user_id, s.caption, s.media_url, s.media_type, s.audience, s.tags,
  s.content_type, s.aspect_ratio, s.framing_aspect_ratio, s.focal_x, s.focal_y, s.zoom, s.dominant_color,
  s.duration_seconds, s.thumbnail_url, s.media_storage_provider, s.media_storage_key,
  s.thumbnail_storage_provider, s.thumbnail_storage_key, s.created_at, s.like_count, s.share_count,
  s.repost_count, s.comment_count, s.view_count, s.pillar, round(s.feed_score::numeric, 4)
FROM slotted s ORDER BY s.global_slot, s.feed_score DESC
LIMIT greatest(1, least(coalesce(p_limit, 20), 500)) OFFSET greatest(0, coalesce(p_offset, 0));
$$;

REVOKE ALL ON FUNCTION public.get_balanced_nexora_feed(integer, integer) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_balanced_nexora_feed(integer, integer) TO authenticated;