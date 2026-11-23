DO $$ BEGIN
  CREATE TYPE public.content_pillar AS ENUM ('comedy', 'education', 'football', 'gaming', 'hustle');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.user_media_posts
  ADD COLUMN IF NOT EXISTS pillar public.content_pillar,
  ADD COLUMN IF NOT EXISTS completion_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.infer_nexora_content_pillar(p_tags text[], p_caption text, p_content_type text)
RETURNS public.content_pillar
LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $$
DECLARE
  v_text text := lower(coalesce(array_to_string(p_tags, ' '), '') || ' ' || coalesce(p_caption, ''));
BEGIN
  IF v_text ~ '(premier.?league|football|soccer|goal|matchday|uefa|fifa|arsenal|chelsea|man.?city|man.?utd|liverpool)' THEN RETURN 'football';
  ELSIF v_text ~ '(exam|study|education|lesson|tutorial|course|programming|coding|math|science|school|university|revision)' THEN RETURN 'education';
  ELSIF v_text ~ '(gaming|gamer|gameplay|esports|playstation|xbox|minecraft|fortnite)' THEN RETURN 'gaming';
  ELSIF v_text ~ '(comedy|meme|memes|skit|funny|joke|viral|humou?r)' THEN RETURN 'comedy';
  ELSE RETURN 'hustle';
  END IF;
END;
$$;

UPDATE public.user_media_posts
SET pillar = public.infer_nexora_content_pillar(tags, caption, content_type)
WHERE pillar IS NULL;

CREATE OR REPLACE FUNCTION public.set_nexora_post_pillar()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NEW.pillar IS NULL THEN
    NEW.pillar := public.infer_nexora_content_pillar(NEW.tags, NEW.caption, NEW.content_type);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_nexora_post_pillar ON public.user_media_posts;
CREATE TRIGGER set_nexora_post_pillar
BEFORE INSERT OR UPDATE OF tags, caption, content_type, pillar
ON public.user_media_posts FOR EACH ROW EXECUTE FUNCTION public.set_nexora_post_pillar();

ALTER TABLE public.user_media_posts ALTER COLUMN pillar SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_media_posts_tags_gin ON public.user_media_posts USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_user_media_posts_pillar_created ON public.user_media_posts (pillar, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_pillar_affinity (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pillar public.content_pillar NOT NULL,
  weight numeric(4,2) NOT NULL DEFAULT 1.00 CHECK (weight >= 0.50 AND weight <= 2.50),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, pillar)
);
ALTER TABLE public.user_pillar_affinity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read their own pillar affinity" ON public.user_pillar_affinity;
CREATE POLICY "Users can read their own pillar affinity" ON public.user_pillar_affinity FOR SELECT TO authenticated USING (user_id = auth.uid());

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

CREATE OR REPLACE FUNCTION public.bump_nexora_pillar_affinity(p_post_id uuid, p_delta numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user_id uuid := auth.uid(); v_pillar public.content_pillar;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_delta IS NULL OR p_delta < -0.20 OR p_delta > 0.15 THEN RAISE EXCEPTION 'Invalid affinity adjustment'; END IF;
  SELECT p.pillar INTO v_pillar FROM public.user_media_posts p WHERE p.id = p_post_id;
  IF v_pillar IS NULL THEN RETURN; END IF;
  INSERT INTO public.user_pillar_affinity (user_id, pillar, weight, updated_at)
  VALUES (v_user_id, v_pillar, least(2.50, greatest(0.50, 1.00 + p_delta)), now())
  ON CONFLICT (user_id, pillar) DO UPDATE
  SET weight = least(2.50, greatest(0.50, public.user_pillar_affinity.weight + p_delta)), updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.get_balanced_nexora_feed(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_balanced_nexora_feed(integer, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.bump_nexora_pillar_affinity(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_nexora_pillar_affinity(uuid, numeric) TO authenticated;
