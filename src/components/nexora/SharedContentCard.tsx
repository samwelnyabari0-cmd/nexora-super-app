import { useEffect, useState } from "react";
import { ExternalLink, FileVideo, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  canonicalSharedContentPath,
  isValidSharedContentReference,
  sharedContentLabel,
  type SharedContentReference,
} from "./shared-content";

type SharedContentCardProps = SharedContentReference;

type ResolvedContent = {
  caption: string | null;
  creatorName: string;
  creatorHandle: string | null;
  mediaUrl: string | null;
  path: string | null;
};

function firstMediaSource(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed) && typeof parsed[0] === "string") return parsed[0];
  } catch {
    // A normal storage path or URL is expected.
  }
  return value;
}

async function resolvePrivateMedia(value: string | null, allowExternal: boolean): Promise<string | null> {
  const source = firstMediaSource(value);
  if (!source) return null;
  if (/^https?:\/\//i.test(source)) return allowExternal ? source : null;
  const { data, error } = await supabase.storage.from("post-media").createSignedUrl(source, 60);
  return error ? null : data?.signedUrl ?? null;
}

export function SharedContentCard({ source, contentId, contentType }: SharedContentCardProps) {
  const [content, setContent] = useState<ResolvedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setContent(null);

    void (async () => {
      const reference = { source, contentId, contentType };
      if (!isValidSharedContentReference(reference)) {
        if (!cancelled) setLoading(false);
        return;
      }

      let row: any = null;
      if (source === "posts") {
        const { data, error } = await (supabase as any)
          .from("posts")
          .select("id, author_id, caption, media_url, media_type, audience")
          .eq("id", contentId)
          .maybeSingle();
        if (error) {
          if (!cancelled) setLoading(false);
          return;
        }
        row = data;
      } else {
        const { data, error } = await (supabase as any)
          .from("user_media_posts")
          .select("id, user_id, original_author_id, caption, media_url, thumbnail_url, media_type, content_type, audience")
          .eq("id", contentId)
          .maybeSingle();
        if (error) {
          if (!cancelled) setLoading(false);
          return;
        }
        row = data;
        if (row?.content_type !== contentType) row = null;
      }

      if (!row) {
        if (!cancelled) setLoading(false);
        return;
      }

      const creatorId = source === "posts" ? row.author_id : row.user_id ?? row.original_author_id;
      let creatorName = "NEXORA creator";
      let creatorHandle: string | null = null;
      if (creatorId) {
        const { data: profiles } = await (supabase as any).rpc("get_public_profiles", {
          profile_ids: [creatorId],
        });
        const profile = Array.isArray(profiles) ? profiles[0] : null;
        if (profile) {
          creatorName = profile.display_name || "NEXORA creator";
          creatorHandle = profile.handle || null;
        }
      }

      const mediaValue = source === "posts" ? row.media_url : row.thumbnail_url || row.media_url;
      const mediaUrl = await resolvePrivateMedia(mediaValue, row.audience === "public");
      const path = canonicalSharedContentPath(reference, creatorHandle);
      if (!cancelled) {
        setContent({
          caption: row.caption ?? null,
          creatorName,
          creatorHandle,
          mediaUrl,
          path,
        });
        setLoading(false);
      }
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [contentId, contentType, source, refreshToken]);

  useEffect(() => {
    const refreshTimer = window.setInterval(() => setRefreshToken((value) => value + 1), 45_000);
    return () => window.clearInterval(refreshTimer);
  }, []);

  const label = sharedContentLabel(contentType);
  if (loading) {
    return <div className="mb-2 flex max-w-sm items-center gap-3 rounded-xl border p-3 text-xs text-muted-foreground">Loading shared {label.toLowerCase()}…</div>;
  }
  if (!content) {
    return (
      <div className="mb-2 flex max-w-sm items-center gap-3 rounded-xl border p-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted"><FileVideo className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-medium">Content unavailable</span><span className="block text-xs text-muted-foreground">The original item was deleted or you no longer have permission to view it.</span></span>
      </div>
    );
  }

  return (
    <div className="mb-2 flex max-w-sm items-center gap-3 rounded-xl border border-current/10 bg-background/40 p-3">
      {content.mediaUrl ? (
        <img src={content.mediaUrl} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><ImageIcon className="h-5 w-5" /></span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary">{label}</span>
        <span className="block truncate text-sm font-medium">{content.caption || `NEXORA ${label}`}</span>
        <span className="block truncate text-xs text-muted-foreground">{content.creatorName}{content.creatorHandle ? ` · @${content.creatorHandle}` : ""}</span>
      </span>
      {content.path ? (
        <a href={content.path} className="rounded-lg p-2 text-primary hover:bg-primary/10" aria-label={`Open shared ${label}`}>
          <ExternalLink className="h-4 w-4" />
        </a>
      ) : (
        <span className="text-[10px] text-muted-foreground">Open unavailable</span>
      )}
    </div>
  );
}
