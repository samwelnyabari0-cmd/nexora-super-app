import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";

export function useSocialGraph(profileId?: string) {
  const { user } = useSession();
  const targetId = profileId ?? user?.id;
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!targetId) {
      setFollowers(0);
      setFollowing(0);
      setIsFollowing(false);
      setIsPending(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [{ count: followerCount }, { count: followingCount }, { data: relation }, { data: pendingRequest }] = await Promise.all([
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
      user
        ? (supabase as any).from("follow_requests").select("id").eq("requester_id", user.id).eq("target_id", targetId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    setIsFollowing(Boolean(relation));
    setIsPending(Boolean(pendingRequest));
    setFollowers(followerCount ?? 0);
    setFollowing(followingCount ?? 0);
    setLoading(false);
  }, [targetId, user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleFollow = useCallback(async () => {
    if (!user || !targetId || user.id === targetId) return;
    setLoading(true);
    setError(null);
    if (isFollowing) {
      const { error: deleteError } = await (supabase as any)
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", targetId);
      if (deleteError) {
        setError(deleteError.message || "Could not update follow status.");
        setLoading(false);
        return;
      }
    } else if (isPending) {
      const { error: cancelError } = await (supabase as any)
        .from("follow_requests")
        .delete()
        .eq("requester_id", user.id)
        .eq("target_id", targetId);
      if (cancelError) {
        setError(cancelError.message || "Could not cancel follow request.");
        setLoading(false);
        return;
      }
    } else {
      const { error: followError } = await (supabase as any).rpc("request_or_follow_profile", { p_target_id: targetId });
      if (followError) {
        setError(followError.message || "Could not update follow status.");
        setLoading(false);
        return;
      }
    }
    await refresh();
  }, [isFollowing, isPending, refresh, targetId, user]);

  return { followers, following, isFollowing, isPending, loading, error, toggleFollow, refresh };
}
