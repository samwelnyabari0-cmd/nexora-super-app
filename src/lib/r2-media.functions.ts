import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// A single R2 PutObject upload supports files up to 5 GB.
// Multipart upload will be a separate implementation before larger files are enabled.
const MAX_R2_MEDIA_BYTES = 5 * 1024 ** 3;
const MEDIA_TYPES = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-matroska": "mkv",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
} as const;
const mediaTypeSchema = z.enum([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

function getR2MediaConfig() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("R2 media storage is not configured. Check the existing R2 environment variables in Vercel.");
  }

  return {
    bucket,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

const uploadInputSchema = z.object({
  contentType: mediaTypeSchema,
  size: z.number().int().positive().max(MAX_R2_MEDIA_BYTES),
});

export const createR2MediaUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => uploadInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { client, bucket } = getR2MediaConfig();
    const extension = MEDIA_TYPES[data.contentType];
    const key = `${context.userId}/posts/${crypto.randomUUID()}.${extension}`;
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: data.contentType,
      Metadata: {
        owner: context.userId,
        purpose: "post-media",
        expected_size: String(data.size),
      },
    });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });

    return {
      provider: "r2" as const,
      key,
      uploadUrl,
      contentType: data.contentType,
      // The browser must send these exact headers with the PUT request.
      uploadHeaders: {
        "Content-Type": data.contentType,
        "x-amz-meta-owner": context.userId,
        "x-amz-meta-purpose": "post-media",
        "x-amz-meta-expected_size": String(data.size),
      },
      expiresInSeconds: 300,
    };
  });

const completeInputSchema = z.object({
  key: z.string().min(1).max(512),
  contentType: mediaTypeSchema,
  size: z.number().int().positive().max(MAX_R2_MEDIA_BYTES),
});

export const verifyR2MediaUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => completeInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ownerPrefix = `${context.userId}/posts/`;
    if (!data.key.startsWith(ownerPrefix) || data.key.includes("..")) {
      throw new Error("Invalid media object key.");
    }

    const { client, bucket } = getR2MediaConfig();
    const object = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: data.key }),
    );

    if (
      object.ContentLength !== data.size ||
      object.ContentType !== data.contentType ||
      object.Metadata?.owner !== context.userId ||
      object.Metadata?.purpose !== "post-media" ||
      object.Metadata?.expected_size !== String(data.size)
    ) {
      throw new Error("Uploaded media failed server-side verification.");
    }

    return {
      provider: "r2" as const,
      key: data.key,
      contentType: data.contentType,
      size: object.ContentLength,
      verified: true as const,
    };
  });


const playbackInputSchema = z.object({
  postId: z.string().uuid(),
  asset: z.enum(["media", "thumbnail"]),
});

export const createR2MediaPlaybackUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => playbackInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Query through the caller's Supabase session so existing RLS policies apply.
    const { data: post, error } = await (context.supabase as any)
      .from("user_media_posts")
      .select("id, user_id, audience, media_storage_provider, media_storage_key, thumbnail_storage_provider, thumbnail_storage_key")
      .eq("id", data.postId)
      .maybeSingle();

    if (error || !post) throw new Error("Media post is unavailable.");

    const isOwner = post.user_id === context.userId;
    if (!isOwner && post.audience !== "public") {
      throw new Error("You do not have permission to view this media.");
    }

    const provider = data.asset === "media"
      ? post.media_storage_provider
      : post.thumbnail_storage_provider;
    const key = data.asset === "media"
      ? post.media_storage_key
      : post.thumbnail_storage_key;

    if (provider !== "r2" || typeof key !== "string" || !key.startsWith(`${post.user_id}/posts/`)) {
      throw new Error("R2 media reference is invalid.");
    }

    const { client, bucket } = getR2MediaConfig();
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 900 },
    );
    return { url, expiresInSeconds: 900 };
  });


const cleanupInputSchema = z.object({
  keys: z.array(z.string().min(1).max(512)).min(1).max(2),
});

export const cleanupR2MediaObjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => cleanupInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const prefix = `${context.userId}/posts/`;
    if (data.keys.some((key) => !key.startsWith(prefix) || key.includes(".."))) {
      throw new Error("Invalid media cleanup key.");
    }
    const { client, bucket } = getR2MediaConfig();
    await Promise.all(data.keys.map((Key) =>
      client.send(new DeleteObjectCommand({ Bucket: bucket, Key }))
    ));
    return { deleted: data.keys.length };
  });


function createPublicSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(
          typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
        );
        if (init?.headers) new Headers(init.headers).forEach((value, name) => headers.set(name, value));
        if ((key.startsWith("sb_publishable_") || key.startsWith("sb_secret_")) && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export const createPublicR2MediaPlaybackUrl = createServerFn({ method: "POST" })
  .validator((input: unknown) => playbackInputSchema.parse(input))
  .handler(async ({ data }) => {
    // Anonymous callers may receive URLs only for posts explicitly marked public.
    const publicSupabase = createPublicSupabaseClient();
    const { data: post, error } = await (publicSupabase as any)
      .from("user_media_posts")
      .select("id, user_id, audience, media_storage_provider, media_storage_key, thumbnail_storage_provider, thumbnail_storage_key")
      .eq("id", data.postId)
      .eq("audience", "public")
      .maybeSingle();

    if (error || !post) throw new Error("Public media post is unavailable.");

    const provider = data.asset === "media"
      ? post.media_storage_provider
      : post.thumbnail_storage_provider;
    const key = data.asset === "media"
      ? post.media_storage_key
      : post.thumbnail_storage_key;

    if (provider !== "r2" || typeof key !== "string" || !key.startsWith(`${post.user_id}/posts/`)) {
      throw new Error("Public R2 media reference is invalid.");
    }

    const { client, bucket } = getR2MediaConfig();
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 900 },
    );
    return { url, expiresInSeconds: 900 };
  });
