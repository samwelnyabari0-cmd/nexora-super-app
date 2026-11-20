type R2UploadExpectation = {
  ownerId: string;
  contentType: string;
  size: number;
};

type R2HeadObject = {
  ContentLength?: number;
  ContentType?: string;
  Metadata?: Record<string, string>;
};

export function isValidR2PostObjectKey(ownerId: string, key: string): boolean {
  return key.startsWith(`${ownerId}/posts/`) && !key.includes("..");
}

export function isVerifiedR2Upload(
  expected: R2UploadExpectation,
  object: R2HeadObject,
): boolean {
  return (
    object.ContentLength === expected.size &&
    object.ContentType === expected.contentType &&
    object.Metadata?.owner === expected.ownerId &&
    object.Metadata?.purpose === "post-media" &&
    object.Metadata?.expected_size === String(expected.size)
  );
}
