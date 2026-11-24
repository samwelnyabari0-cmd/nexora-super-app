import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const buckets = [
  "academy-resources",
  "academy-videos",
  "chat-media",
  "creator-drafts",
  "kyc-documents",
  "post-media",
];

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function listOwnedFiles(client: ReturnType<typeof createClient>, bucket: string, prefix: string): Promise<string[]> {
  const files: string[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`Could not inspect ${bucket} uploads: ${error.message}`);
    for (const item of data ?? []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      const isFolder = item.id === null && item.metadata === null;
      if (isFolder) files.push(...await listOwnedFiles(client, bucket, path));
      else files.push(path);
    }
    if (!data || data.length < 1000) break;
    offset += data.length;
  }
  return files;
}

async function deleteRows(client: ReturnType<typeof createClient>, table: string, column: string, userId: string) {
  const { error } = await client.from(table).delete().eq(column, userId);
  if (error && error.code !== "42P01") {
    throw new Error(`Could not remove account data from ${table}: ${error.message}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response(405, { error: "Method not allowed." });

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return response(401, { error: "Sign in again to delete your account." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return response(500, { error: "Account deletion is not configured. Please contact support." });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  const user = authData.user;
  if (authError || !user) return response(401, { error: "Your session is invalid. Sign in again." });

  let body: { confirmation?: string };
  try {
    body = await req.json();
  } catch {
    return response(400, { error: "A confirmation phrase is required." });
  }
  if (body.confirmation !== "DELETE MY ACCOUNT") {
    return response(400, { error: "Type DELETE MY ACCOUNT exactly to confirm permanent deletion." });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // Transfer owned Squads to an active co-member before removing the current owner.
    const { data: ownedClubs, error: clubsError } = await admin
      .from("clubs").select("id").eq("owner_user_id", user.id);
    if (clubsError) throw new Error(`Could not prepare Squad ownership: ${clubsError.message}`);

    for (const club of ownedClubs ?? []) {
      const { data: members, error: membersError } = await admin
        .from("club_memberships")
        .select("user_id, role")
        .eq("club_id", club.id)
        .eq("status", "active")
        .neq("user_id", user.id);
      if (membersError) throw new Error(`Could not inspect Squad members: ${membersError.message}`);

      const successor = (members ?? []).find((member) => member.role === "admin")
        ?? (members ?? []).find((member) => member.role === "moderator")
        ?? (members ?? []).find((member) => member.role === "member");

      if (successor) {
        const { error: ownerError } = await admin.from("clubs")
          .update({ owner_user_id: successor.user_id }).eq("id", club.id);
        if (ownerError) throw new Error(`Could not transfer Squad ownership: ${ownerError.message}`);
        const { error: roleError } = await admin.from("club_memberships")
          .update({ role: "creator" }).eq("club_id", club.id).eq("user_id", successor.user_id);
        if (roleError) throw new Error(`Could not assign the new Squad owner: ${roleError.message}`);
      } else {
        for (const table of ["club_messages", "club_events", "club_membership_activity", "club_invitations", "club_memberships"]) {
          const { error } = await admin.from(table).delete().eq("club_id", club.id);
          if (error) throw new Error(`Could not remove an empty owned Squad (${table}): ${error.message}`);
        }
        const { error: clubDeleteError } = await admin.from("clubs").delete().eq("id", club.id);
        if (clubDeleteError) throw new Error(`Could not remove an empty owned Squad: ${clubDeleteError.message}`);
      }
    }

    // Remove rows whose foreign keys intentionally restrict Auth-user deletion.
    for (const [table, column] of [
      ["user_media_post_likes", "user_id"],
      ["user_media_post_comments", "user_id"],
      ["creator_payout_destination_reviews", "reviewer_id"],
      ["moderation_audit_logs", "moderator_id"],
      ["chat_message_settings", "updated_by"],
    ]) {
      await deleteRows(admin, table, column, user.id);
    }

    // Remove user-authored media and account-scoped activity not covered by Auth cascades.
    for (const [table, column] of [
      ["user_media_posts", "user_id"],
      ["user_media_post_bookmarks", "user_id"],
      ["user_media_post_reposts", "user_id"],
      ["user_media_post_saves", "user_id"],
      ["user_media_post_completions", "user_id"],
      ["user_media_post_not_interested", "user_id"],
      ["user_media_post_views", "viewer_id"],
      ["creator_drafts", "user_id"],
    ]) {
      await deleteRows(admin, table, column, user.id);
    }
    const { error: creatorViewsError } = await admin.from("user_media_post_views")
      .delete().eq("creator_id", user.id);
    if (creatorViewsError && creatorViewsError.code !== "42P01") throw creatorViewsError;

    // First-party upload paths are namespaced by the authenticated user UUID.
    for (const bucket of buckets) {
      const files = await listOwnedFiles(admin, bucket, user.id);
      for (let index = 0; index < files.length; index += 100) {
        const { error } = await admin.storage.from(bucket).remove(files.slice(index, index + 100));
        if (error) throw new Error(`Could not remove ${bucket} uploads: ${error.message}`);
      }
    }

    // Revoke refresh tokens across devices, then permanently remove the Auth user.
    const { error: signOutError } = await userClient.auth.signOut({ scope: "global" });
    if (signOutError) throw new Error(`Could not revoke active sessions: ${signOutError.message}`);

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw new Error(`Could not permanently delete the account: ${deleteError.message}`);

    return response(200, { success: true });
  } catch (error) {
    console.error("Account deletion failed:", error);
    return response(500, {
      error: error instanceof Error ? error.message : "Account deletion failed. Please contact support.",
    });
  }
});
