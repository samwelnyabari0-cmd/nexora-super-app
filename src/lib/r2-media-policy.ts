type R2UploadExpectation = {
  ownerId: string;
  contentType: string;
  size: number;
};

type R2HeadObject = {
  ContentLength?: number;
  ContentType?: string;
};

export function isValidR2PostObjectKey(ownerId: string, key: string): boolean {
  return key.startsWith(`${ownerId}/posts/`) && !key.includes("..");
}

export function isVerifiedR2Upload(
  expected: R2UploadExpectation,
  object: R2HeadObject,
): boolean {
  // Ownership is enforced by isValidR2PostObjectKey before this check.
  // Avoid requiring custom x-amz metadata headers from browser uploads.
  return (
    object.ContentLength === expected.size &&
    object.ContentType === expected.contentType
  );
}
