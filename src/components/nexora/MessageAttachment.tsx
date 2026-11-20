import { FileText, Download } from "lucide-react";
import { documentTypeLabel, formatAttachmentSize, safeAttachmentName } from "./message-attachments";

type MessageAttachmentProps = {
  url?: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

export function MessageAttachment({ url, fileName, mimeType, sizeBytes }: MessageAttachmentProps) {
  const name = safeAttachmentName(fileName ?? "");
  return (
    <div className="mb-2 flex max-w-sm items-center gap-3 rounded-xl border border-current/10 bg-background/40 p-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <FileText className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium" title={name}>{name}</span>
        <span className="block text-xs text-muted-foreground">
          {documentTypeLabel(mimeType)} · {typeof sizeBytes === "number" ? formatAttachmentSize(sizeBytes) : "Size unavailable"}
        </span>
      </span>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          download={name}
          className="rounded-lg p-2 text-primary hover:bg-primary/10"
          aria-label={`Open ${name}`}
        >
          <Download className="h-4 w-4" />
        </a>
      ) : (
        <span className="text-xs text-muted-foreground">Unavailable</span>
      )}
    </div>
  );
}
