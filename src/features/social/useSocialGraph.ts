import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";

export function useSocialGraph(profileId?: string) {
  const { user } = useSession();
  const targetId = profileId ?? user?.id;
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!targetId) {
      setFollowers(0);
      setFollowing(0);
      setLoading(false);
      return;
    }
    const [{ count: followerCount }, { count: followingCount }, { data: relation }] =
      await Promise.all([
        (supabase as any)
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("following_id", targetId),
        (supabase as any)
          .from("follows")
          .select("following_id", { count: "exact", head: true })
          .eq("follower_id", targetId),
        user
          ? (supabase as any)
              .from("follows")
              .select("following_id")
              .eq("follower_id", user.id)
              .eq("following_id", targetId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
    setIsFollowing(Boolean(relation));
    setFollowers(followerCount ?? 0);
    setFollowing(followingCount ?? 0);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleFollow = useCallback(async () => {
    if (!user || !targetId || user.id === targetId) return;
    setLoading(true);
    if (isFollowing)
      await (supabase as any)
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", targetId);
    else {
      const { error } = await (supabase as any)
        .from("follows")
        .insert({ follower_id: user.id, following_id: targetId });
      if (!error)
        await (supabase as any).from("notifications").insert({
          recipient_id: targetId,
          actor_id: user.id,
          kind: "follow",
          body: "started following you",
        });
    }
    await refresh();
    setLoading(false);
  }, [isFollowing, refresh, targetId, user]);

  return { followers, following, isFollowing, loading, toggleFollow, refresh };
}
