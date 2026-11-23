import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";

type MediaComment = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  display_name?: string | null;
  handle?: string | null;
  avatar_url?: string | null;
};

export function MediaComments({
  postId,
  open,
  onClose,
  variant = "panel",
  onCountChange,
}: {
  postId: string;
  open: boolean;
  onClose: () => void;
  variant?: "panel" | "sheet";
  onCountChange?: (count: number) => void;
}) {
  const { user } = useSession();
  const [comments, setComments] = useState<MediaComment[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const onCountChangeRef = useRef(onCountChange);
  onCountChangeRef.current = onCountChange;

  const loadComments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("user_media_post_comments")
      .select("id, user_id, text, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Could not load media comments:", error);
      toast.error("Could not load comments.");
      setLoading(false);
      return;
    }

    const rows = (data ?? []).map((row: any) => ({ ...row, content: row.text })) as MediaComment[];
    const userIds = [...new Set(rows.map((comment) => comment.user_id).filter(Boolean))];
    let profileById: Record<string, { display_name: string | null; handle: string | null; avatar_url: string | null }> = {};
    if (userIds.length) {
      const { data: profiles, error: profilesError } = await (supabase as any)
        .rpc("get_public_comment_profiles", { target_user_ids: userIds });
      if (!profilesError) profileById = Object.fromEntries((profiles ?? []).map((profile: any) => [profile.id, profile]));
    }
    const hydrated = rows.map((comment) => ({
      ...comment,
      display_name: profileById[comment.user_id]?.display_name ?? null,
      handle: profileById[comment.user_id]?.handle ?? null,
      avatar_url: profileById[comment.user_id]?.avatar_url ?? null,
    }));
    setComments(hydrated);
    onCountChangeRef.current?.(hydrated.length);
    setLoading(false);
  }, [postId]);

  useEffect(() => {
    if (open) void loadComments();
  }, [open, loadComments]);

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    if (!user) {
      toast.error("Sign in to comment.");
      return;
    }
    setSending(true);
    const { error } = await (supabase as any)
      .from("user_media_post_comments")
      .insert({ post_id: postId, user_id: user.id, text: content });
    if (error) {
      console.error("Could not add media comment:", error);
      toast.error("Could not add your comment.");
      setSending(false);
      return;
    }
    setDraft("");
    toast.success("Comment added.");
    await loadComments();
    setSending(false);
  }

  if (!open) return null;

  const content = (
    <section aria-label="Comments" className={variant === "sheet"
      ? "flex max-h-[78svh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-zinc-950 text-white shadow-2xl"
      : "flex max-h-[min(70vh,560px)] min-h-64 flex-col overflow-hidden rounded-xl border bg-card"}>
      <header className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2 font-semibold"><MessageCircle className="h-5 w-5" /> Comments <span className="text-xs font-normal text-muted-foreground">{comments.length}</span></div>
        <button type="button" onClick={onClose} aria-label="Close comments" className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted/20"><X className="h-5 w-5" /></button>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {loading ? <p className="py-6 text-center text-sm text-muted-foreground">Loading comments…</p>
          : comments.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No comments yet. Start the conversation.</p>
          : comments.map((comment) => {
            const name = comment.display_name || comment.handle || "NEXORA User";
            return <article key={comment.id} className="flex items-start gap-3">
              {comment.avatar_url ? <img src={comment.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold">{name.slice(0, 1).toUpperCase()}</span>}
              <div className="min-w-0 flex-1">
                <p className="text-sm"><span className="mr-2 font-semibold">{name}</span>{comment.content}</p>
                <time className="mt-1 block text-[11px] text-muted-foreground">{new Date(comment.created_at).toLocaleString()}</time>
              </div>
            </article>;
          })}
      </div>
      <form onSubmit={submitComment} className="flex items-center gap-2 border-t p-3">
        <label className="sr-only" htmlFor={`media-comment-${postId}`}>Write a comment</label>
        <input id={`media-comment-${postId}`} value={draft} onChange={(event) => setDraft(event.target.value)}
          placeholder={user ? "Add a comment…" : "Sign in to comment…"}
          className="min-w-0 flex-1 rounded-full border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary" maxLength={2000} />
        <button type="submit" disabled={!draft.trim() || sending} aria-label="Post comment" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  );

  if (variant === "sheet") return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full max-w-xl" onClick={(event) => event.stopPropagation()}>{content}</div>
    </div>
  );

  return content;
}
