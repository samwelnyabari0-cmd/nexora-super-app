export type R2PostStorageMetadata = {
  media_storage_provider?: string | null;
  media_storage_key?: string | null;
  thumbnail_storage_provider?: string | null;
  thumbnail_storage_key?: string | null;
};

/** Return only unique R2 object keys referenced by a post. */
export function getR2PostObjectKeys(post: R2PostStorageMetadata): string[] {
  const keys = [
    post.media_storage_provider === "r2" ? post.media_storage_key : null,
    post.thumbnail_storage_provider === "r2" ? post.thumbnail_storage_key : null,
  ];
  return [...new Set(keys.filter((key): key is string => typeof key === "string" && key.length > 0))];
}
