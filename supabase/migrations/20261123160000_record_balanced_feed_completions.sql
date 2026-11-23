CREATE TABLE IF NOT EXISTS public.user_media_post_completions (
  post_id uuid NOT NULL REFERENCES public.user_media_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE public.user_media_post_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read their own media completions" ON public.user_media_post_completions;
CREATE POLICY "Users can read their own media completions"
ON public.user_media_post_completions FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.record_nexora_post_completion(p_post_id uuid)
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
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT p.pillar INTO v_pillar
  FROM public.user_media_posts p
  LEFT JOIN public.profiles author ON author.id = p.user_id
  WHERE p.id = p_post_id
    AND (
      p.user_id = v_user_id
      OR (
        p.audience = 'public'
        AND (
          coalesce(author.private_profile, false) = false
          OR EXISTS (
            SELECT 1 FROM public.user_follows f
            WHERE f.follower_id = v_user_id AND f.following_id = p.user_id
          )
        )
      )
    );

  IF v_pillar IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_media_post_completions(post_id, user_id)
  VALUES (p_post_id, v_user_id)
  ON CONFLICT DO NOTHING
  RETURNING post_id INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.user_media_posts
  SET completion_count = completion_count + 1
  WHERE id = p_post_id;

  INSERT INTO public.user_pillar_affinity(user_id, pillar, weight, updated_at)
  VALUES (v_user_id, v_pillar, 1.15, now())
  ON CONFLICT (user_id, pillar) DO UPDATE
  SET weight = least(2.50, greatest(0.50, public.user_pillar_affinity.weight + 0.15)),
      updated_at = now();

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_nexora_post_completion(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_nexora_post_completion(uuid) TO authenticated;