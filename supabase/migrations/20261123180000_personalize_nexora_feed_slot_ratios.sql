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
pillar_quotas AS (
  SELECT v.pillar, v.base_order,
    least(15, greatest(1, round(v.base_quota * 5 * coalesce(uw.weight, 1.0))::integer)) AS quota
  FROM (VALUES
    ('comedy'::public.content_pillar, 1, 2),
    ('football'::public.content_pillar, 2, 1),
    ('education'::public.content_pillar, 3, 1),
    ('gaming'::public.content_pillar, 4, 1),
    ('hustle'::public.content_pillar, 5, 1)
  ) AS v(pillar, base_order, base_quota)
  LEFT JOIN user_weights uw ON uw.pillar = v.pillar
),
schedule AS (
  SELECT pq.pillar, gs.slot_index,
    row_number() OVER (
      ORDER BY (gs.slot_index::numeric - 0.5) / pq.quota, pq.base_order, gs.slot_index
    )::integer AS schedule_position,
    sum(pq.quota) OVER ()::integer AS cycle_length
  FROM pillar_quotas pq
  CROSS JOIN LATERAL generate_series(1, pq.quota) AS gs(slot_index)
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
scheduled_posts AS (
  SELECT r.*, s.schedule_position, s.cycle_length,
    ((r.pillar_rank - 1) / pq.quota)::integer AS cycle_index
  FROM ranked r
  JOIN pillar_quotas pq ON pq.pillar = r.pillar
  JOIN schedule s
    ON s.pillar = r.pillar
   AND s.slot_index = ((r.pillar_rank - 1) % pq.quota) + 1
)
SELECT s.id, s.user_id, s.caption, s.media_url, s.media_type, s.audience, s.tags,
  s.content_type, s.aspect_ratio, s.framing_aspect_ratio, s.focal_x, s.focal_y, s.zoom, s.dominant_color,
  s.duration_seconds, s.thumbnail_url, s.media_storage_provider, s.media_storage_key,
  s.thumbnail_storage_provider, s.thumbnail_storage_key, s.created_at, s.like_count, s.share_count,
  s.repost_count, s.comment_count, s.view_count, s.pillar, round(s.feed_score::numeric, 4)
FROM scheduled_posts s
ORDER BY (s.cycle_index * s.cycle_length + s.schedule_position), s.feed_score DESC
LIMIT greatest(1, least(coalesce(p_limit, 20), 500)) OFFSET greatest(0, coalesce(p_offset, 0));
$$;

REVOKE ALL ON FUNCTION public.get_balanced_nexora_feed(integer, integer) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_balanced_nexora_feed(integer, integer) TO authenticated;