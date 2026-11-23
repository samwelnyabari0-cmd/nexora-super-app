REVOKE ALL ON FUNCTION public.get_balanced_nexora_feed(integer, integer) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_balanced_nexora_feed(integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.bump_nexora_pillar_affinity(p_post_id uuid, p_delta numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_pillar public.content_pillar;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_delta = 0.05 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_media_post_likes
      WHERE user_id = v_user_id AND post_id = p_post_id
    ) THEN
      RAISE EXCEPTION 'Like action required';
    END IF;
  ELSIF p_delta = 0.15 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_media_post_bookmarks
      WHERE user_id = v_user_id AND post_id = p_post_id
    ) THEN
      RAISE EXCEPTION 'Bookmark action required';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported affinity adjustment';
  END IF;

  SELECT p.pillar INTO v_pillar
  FROM public.user_media_posts p
  WHERE p.id = p_post_id;

  IF v_pillar IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.user_pillar_affinity (user_id, pillar, weight, updated_at)
  VALUES (v_user_id, v_pillar, least(2.50, greatest(0.50, 1.00 + p_delta)), now())
  ON CONFLICT (user_id, pillar) DO UPDATE
  SET weight = least(2.50, greatest(0.50, public.user_pillar_affinity.weight + p_delta)),
      updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.bump_nexora_pillar_affinity(uuid, numeric) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_nexora_pillar_affinity(uuid, numeric) TO authenticated;

DROP POLICY IF EXISTS "Users can read their own pillar affinity" ON public.user_pillar_affinity;
CREATE POLICY "Users can read their own pillar affinity"
ON public.user_pillar_affinity
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));