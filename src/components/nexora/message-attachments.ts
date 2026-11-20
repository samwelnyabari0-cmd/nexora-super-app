export const MAX_CHAT_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

const MIME_EXTENSIONS: Record<(typeof DOCUMENT_MIME_TYPES)[number], string[]> = {
  "application/pdf": ["pdf"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.ms-excel": ["xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/vnd.ms-powerpoint": ["ppt"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"],
};

export type DocumentValidation = { ok: true; extension: string } | { ok: false; reason: string };

export function validateDocumentFile(file: Pick<File, "type" | "name" | "size">): DocumentValidation {
  const mime = file.type.trim().toLowerCase() as (typeof DOCUMENT_MIME_TYPES)[number];
  const extensions = MIME_EXTENSIONS[mime];
  if (!extensions) return { ok: false, reason: "Choose a PDF, Word, Excel, or PowerPoint document." };
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, reason: "The document is empty or has an invalid size." };
  }
  if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
    return { ok: false, reason: "The document must be 50 MB or smaller." };
  }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!extensions.includes(extension)) {
    return { ok: false, reason: "The file extension does not match its document type." };
  }
  return { ok: true, extension };
}

export function safeAttachmentName(name: string): string {
  const leaf = name.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim() ?? "";
  return (leaf || "Shared document").slice(0, 120);
}

export function documentTypeLabel(mimeType?: string | null): string {
  if (!mimeType) return "Document";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "application/msword" || mimeType.includes("wordprocessingml")) return "Word";
  if (mimeType === "application/vnd.ms-excel" || mimeType.includes("spreadsheetml")) return "Excel";
  if (mimeType === "application/vnd.ms-powerpoint" || mimeType.includes("presentationml")) return "PowerPoint";
  return "Document";
}

export function formatAttachmentSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "Size unavailable";
  if (bytes < 1024) return `${Math.floor(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function uploadThenInsertAttachment(
  upload: () => Promise<{ error: unknown | null }>,
  insert: () => Promise<{ error: unknown | null }>,
  rollback: () => Promise<unknown>,
): Promise<{ error: unknown | null }> {
  let uploadedSuccessfully = false;
  try {
    const uploaded = await upload();
    if (uploaded.error) return { error: uploaded.error };
    uploadedSuccessfully = true;
    const inserted = await insert();
    if (inserted.error) {
      try { await rollback(); } catch { /* best-effort cleanup */ }
      return { error: inserted.error };
    }
    return { error: null };
  } catch (error) {
    if (uploadedSuccessfully) {
      try { await rollback(); } catch { /* best-effort cleanup */ }
    }
    return { error };
  }
}
