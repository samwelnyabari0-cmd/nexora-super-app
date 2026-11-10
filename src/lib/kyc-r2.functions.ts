import { createServerFn } from "@tanstack/react-start";
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MIME_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
const mimeTypeSchema = z.enum(["image/jpeg", "image/png", "image/webp"]);
const documentTypeSchema = z.enum(["national_id", "passport", "drivers_license"]);
const categorySchema = z.enum([
  "Tech & Gaming",
  "Sports & Health",
  "Arts & Creative",
  "Business / Sales",
  "Music & Audio",
  "Education & Lifestyle",
]);

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Private KYC storage is not configured. Set the R2 environment variables in Vercel.");
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
  front: z.object({ contentType: mimeTypeSchema, size: z.number().int().positive().max(MAX_FILE_BYTES) }),
  back: z.object({ contentType: mimeTypeSchema, size: z.number().int().positive().max(MAX_FILE_BYTES) }).optional(),
});

export const createKycUploadUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => uploadInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { client, bucket } = getR2Config();
    const upload = async (side: "front" | "back", file: { contentType: keyof typeof MIME_TYPES; size: number }) => {
      const key = `${context.userId}/${crypto.randomUUID()}/${side}.${MIME_TYPES[file.contentType]}`;
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: file.contentType,
        Metadata: { owner: context.userId, purpose: "kyc" },
      });
      const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
      return { key, uploadUrl, contentType: file.contentType };
    };

    return {
      front: await upload("front", data.front),
      back: data.back ? await upload("back", data.back) : null,
    };
  });

const completeInputSchema = z.object({
  frontKey: z.string().min(1).max(512),
  backKey: z.string().min(1).max(512).nullable(),
  documentType: documentTypeSchema,
  category: categorySchema,
});

export const completeKycUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => completeInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const userPrefix = `${context.userId}/`;
    const keys = [data.frontKey, data.backKey].filter((key): key is string => key !== null);
    if (keys.some((key) => !key.startsWith(userPrefix)) || new Set(keys).size !== keys.length) {
      throw new Error("Invalid KYC document key.");
    }

    const { client, bucket } = getR2Config();
    try {
      for (const key of keys) {
        const object = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        if (
          !object.ContentLength || object.ContentLength > MAX_FILE_BYTES ||
          !mimeTypeSchema.safeParse(object.ContentType).success ||
          object.Metadata?.owner !== context.userId || object.Metadata?.purpose !== "kyc"
        ) {
          throw new Error("Uploaded KYC document failed validation.");
        }
      }

      const { error } = await (context.supabase as any).from("kyc_verifications").insert({
        user_id: context.userId,
        document_type: data.documentType,
        category: data.category,
        front_path: data.frontKey,
        back_path: data.backKey,
        status: "pending",
      });
      if (error) throw new Error(error.message);
      return { status: "pending" as const };
    } catch (error) {
      await Promise.allSettled(keys.map((Key) => client.send(new DeleteObjectCommand({ Bucket: bucket, Key }))));
      throw error;
    }
  });
