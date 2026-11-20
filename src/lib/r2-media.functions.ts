import { createServerFn } from "@tanstack/react-start";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
