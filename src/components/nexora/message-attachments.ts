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
  const extension = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() ?? "" : "";
  if (!extensions.includes(extension)) {
    return { ok: false, reason: "The file extension does not match its document type." };
  }
  return { ok: true, extension };
}

export function safeAttachmentName(name: string): string {
  const leaf = name.split(/[\\/]/).pop() ?? "";
  const cleaned = Array.from(leaf)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && !(code >= 127 && code <= 159);
    })
    .join("")
    .trim();
  return (cleaned || "Shared document").slice(0, 120);
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


const CHAT_MEDIA_MIME_TYPES: Record<string, { mediaType: "image" | "video" | "audio"; extensions: string[]; defaultExtension: string }> = {
  "image/jpeg": { mediaType: "image", extensions: ["jpg", "jpeg"], defaultExtension: "jpg" },
  "image/png": { mediaType: "image", extensions: ["png"], defaultExtension: "png" },
  "image/webp": { mediaType: "image", extensions: ["webp"], defaultExtension: "webp" },
  "image/gif": { mediaType: "image", extensions: ["gif"], defaultExtension: "gif" },
  "video/mp4": { mediaType: "video", extensions: ["mp4"], defaultExtension: "mp4" },
  "video/webm": { mediaType: "video", extensions: ["webm"], defaultExtension: "webm" },
  "audio/mp4": { mediaType: "audio", extensions: ["m4a", "mp4"], defaultExtension: "m4a" },
  "audio/ogg": { mediaType: "audio", extensions: ["ogg", "oga"], defaultExtension: "ogg" },
  "audio/mpeg": { mediaType: "audio", extensions: ["mp3", "mpeg"], defaultExtension: "mp3" },
  "audio/ogg": { mediaType: "audio", extensions: ["ogg", "oga"], defaultExtension: "ogg" },
  "audio/wav": { mediaType: "audio", extensions: ["wav"], defaultExtension: "wav" },
  "audio/webm": { mediaType: "audio", extensions: ["webm"], defaultExtension: "webm" },
};

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  mp3: "audio/mpeg",
  mpeg: "audio/mpeg",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  wav: "audio/wav",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export type ChatAttachmentResolution =
  | {
      ok: true;
      mediaType: "image" | "video" | "audio" | "document";
      contentType: string;
      extension: string;
    }
  | { ok: false; reason: string };

/** Resolve mobile-picker MIME quirks while staying within the private chat-media bucket allowlist. */
export function resolveChatAttachment(
  file: Pick<File, "type" | "name" | "size">,
): ChatAttachmentResolution {
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, reason: "The selected file is empty or has an invalid size." };
  }
  if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
    return { ok: false, reason: "Photos and videos must be 50 MB or smaller." };
  }

  const extension = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() ?? "" : "";
  // Android MediaRecorder and gallery pickers commonly append codec parameters
  // (for example, audio/webm;codecs=opus). Storage expects the canonical MIME.
  const declaredType = file.type.trim().toLowerCase().split(";", 1)[0].trim();
  const aliases: Record<string, string> = {
    "image/jpg": "image/jpeg",
    "image/pjpeg": "image/jpeg",
    "audio/mp3": "audio/mpeg",
    "audio/x-m4a": "audio/mp4",
    "audio/x-wav": "audio/wav",
  };
  const normalizedType = aliases[declaredType] ?? declaredType;
  const contentType =
    !normalizedType || normalizedType === "application/octet-stream"
      ? MIME_BY_EXTENSION[extension]
      : normalizedType;

  const media = contentType ? CHAT_MEDIA_MIME_TYPES[contentType] : undefined;
  if (media) {
    if (extension && !media.extensions.includes(extension)) {
      return { ok: false, reason: "The file extension does not match its photo, video, or audio type." };
    }
    return {
      ok: true,
      mediaType: media.mediaType,
      contentType,
      extension: extension || media.defaultExtension,
    };
  }

  const document = validateDocumentFile({
    type: contentType ?? normalizedType,
    name: file.name,
    size: file.size,
  });
  if (document.ok) {
    return {
      ok: true,
      mediaType: "document",
      contentType: contentType ?? normalizedType,
      extension: document.extension,
    };
  }

  return {
    ok: false,
    reason: "This format is not supported. Use JPG, PNG, WEBP, GIF, MP4, WEBM, supported audio, or PDF/Office documents.",
  };
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
