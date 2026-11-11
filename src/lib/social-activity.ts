import { supabase } from "@/integrations/supabase/client";

const ignoreDbError = (error: { message?: string } | null) => {
  if (!error) return false;
  const message = error.message ?? "";
  return /Post not found|Authentication required/i.test(message);
};

export async function incrementPostViews(postId: string) {
  const { error } = await supabase.rpc("increment_post_views", {
    target_post_id: postId,
  });

  if (error && !ignoreDbError(error)) {
    console.error("increment_post_views failed:", error.message);
  }
}

export async function likePost(postId: string) {
  const { error } = await supabase.rpc("like_user_media_post", {
    target_post_id: postId,
  });

  if (error && !ignoreDbError(error)) {
    console.error("like_user_media_post failed:", error.message);
  }
}

export async function unlikePost(postId: string) {
  const { error } = await supabase.rpc("unlike_user_media_post", {
    target_post_id: postId,
  });

  if (error && !ignoreDbError(error)) {
    console.error("unlike_user_media_post failed:", error.message);
  }
}

export async function addCommentToPost(postId: string, text: string) {
  const { data, error } = await supabase.rpc("add_user_media_post_comment", {
    target_post_id: postId,
    comment_text: text,
  });

  if (error && !ignoreDbError(error)) {
    console.error("add_user_media_post_comment failed:", error.message);
    throw error;
  }

  return data;
}

export async function sharePost(postId: string) {
  const { error } = await supabase.rpc("increment_user_media_post_shares", {
    target_post_id: postId,
  });

  if (error && !ignoreDbError(error)) {
    console.error("increment_user_media_post_shares failed:", error.message);
  }
}
