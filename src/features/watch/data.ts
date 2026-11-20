import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type WatchTitle = Tables<"watch_titles">;
export type WatchEpisode = Tables<"watch_episodes">;
export type WatchProgress = Tables<"watch_progress">;

export async function fetchWatchTitles() {
  return supabase
    .from("watch_titles")
    .select("*")
    .eq("is_published", true)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });
}

export async function fetchWatchProgress(userId: string) {
  return supabase
    .from("watch_progress")
    .select("*")
    .eq("user_id", userId);
}

export async function fetchWatchEpisodes(titleId: string) {
  return supabase
    .from("watch_episodes")
    .select("*")
    .eq("title_id", titleId)
    .order("season_number", { ascending: true })
    .order("episode_number", { ascending: true });
}

export async function saveWatchProgress(input: {
  userId: string;
  titleId: string;
  episodeId?: string | null;
  progressSeconds: number;
  totalSeconds: number;
}) {
  const totalSeconds = Math.floor(input.totalSeconds);
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return { error: new Error("A valid video duration is required.") };
  }
  const progressSeconds = Math.floor(
    Math.min(totalSeconds, Math.max(0, Number.isFinite(input.progressSeconds) ? input.progressSeconds : 0)),
  );

  return supabase.from("watch_progress").upsert(
    {
      user_id: input.userId,
      title_id: input.titleId,
      episode_id: input.episodeId ?? null,
      progress_seconds: progressSeconds,
      total_seconds: totalSeconds,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,title_id" },
  );
}
