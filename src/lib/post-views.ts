import { supabase } from "@/integrations/supabase/client";

// The database RPC deduplicates a viewer's count to one view per post per UTC day.
export async function recordUserMediaPostView(postId: string) {
  if (!postId) return;
  const { error } = await (supabase as any).rpc("increment_post_views", {
    target_post_id: postId,
  });
  if (error) console.debug("NEXORA view could not be recorded:", error.message);
}
