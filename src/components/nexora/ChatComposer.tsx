import { useEffect, useRef, useState } from "react";
import { File, Mic, Paperclip, Send, Square, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fileError, microphoneError, type Attachment } from "@/features/core/tools";
import { useApp } from "@/features/core/store";
import { useWorkspace } from "@/features/core/workspace";

export function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  const [broken, setBroken] = useState(false);
  if (broken)
    return (
      <p role="alert" className="text-sm text-destructive">
        Cannot preview {attachment.name}. Your browser may not support this format.
      </p>
    );
  return (
    <div className="min-w-0 space-y-1">
      {attachment.type.startsWith("image/") ? (
        <img
          src={attachment.url}
          alt={attachment.name}
          onError={() => setBroken(true)}
          className="max-h-52 max-w-full rounded-lg object-contain"
        />
      ) : attachment.type.startsWith("video/") ? (
        <video
          src={attachment.url}
          controls
          playsInline
          preload="metadata"
          onError={() => setBroken(true)}
          className="max-h-52 w-full rounded-lg"
        />
      ) : attachment.type.startsWith("audio/") ? (
        <audio
          src={attachment.url}
          controls
          preload="metadata"
          onError={() => setBroken(true)}
          className="w-full max-w-full"
        />
      ) : (
        <a
          href={attachment.url}
          download={attachment.name}
          className="flex items-center gap-2 break-all text-accent"
        >
          <File className="h-4 w-4 shrink-0" />
          {attachment.name}
        </a>
      )}
      <p className="break-all text-xs opacity-80">
        {attachment.name} · {(attachment.size / 1024).toFixed(1)} KB
      </p>
    </div>
  );
}
export function ChatComposer({
  conversationId,
  reply,
  onReplySent,
}: {
  conversationId: string;
  reply?: { id: string; text: string };
  onReplySent?: () => void;
}) {
  const { sendMessage, online } = useApp();
  const { preferences, notify } = useWorkspace();
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const picker = useRef<HTMLInputElement>(null);
  const videoPicker = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const activeStream = useRef<MediaStream | null>(null);
  const mounted = useRef(true);
  const pendingUrls = useRef(new Set<string>());
  useEffect(() => {
    const urls = pendingUrls.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      activeStream.current?.getTracks().forEach((t) => t.stop());
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);
  const addFiles = (files: FileList | null) => {
    setError("");
    if (!files) return;
    const next: Attachment[] = [];
    for (const file of Array.from(files)) {
      const problem = fileError(file);
      if (problem) {
        setError(`${file.name}: ${problem}`);
        continue;
      }
      const url = URL.createObjectURL(file);
      pendingUrls.current.add(url);
      next.push({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        size: file.size,
        url,
      });
    }
    setAttachments((a) => [...a, ...next]);
  };
  const record = async () => {
    setError("");
    if (
      !window.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(
        "Voice recording is unavailable in this browser. Open NEXORA over HTTPS in Safari or Chrome, or attach an audio file.",
      );
      return;
    }
    setRequesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      activeStream.current = stream;
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorder.current = r;
      const chunks: BlobPart[] = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onerror = () => {
        setError("Recording failed. Try again or attach an audio file.");
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
      };
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        recorder.current = null;
        activeStream.current = null;
        if (!mounted.current) return;
        setRecording(false);
        const blob = new Blob(chunks, { type: r.mimeType || "audio/webm" });
        if (!blob.size) {
          setError("No audio captured. Check your microphone and try again.");
          return;
        }
        const problem = fileError({ size: blob.size, name: "Voice message" });
        if (problem) {
          setError(problem);
          return;
        }
        const url = URL.createObjectURL(blob);
        pendingUrls.current.add(url);
        setAttachments((a) => [
          ...a,
          {
            id: crypto.randomUUID(),
            name: `Voice message.${r.mimeType.includes("mp4") ? "m4a" : r.mimeType.includes("ogg") ? "ogg" : "webm"}`,
            type: blob.type,
            size: blob.size,
            url,
          },
        ]);
      };
      r.start();
      setSeconds(0);
      setRecording(true);
    } catch (e) {
      activeStream.current?.getTracks().forEach((t) => t.stop());
      setError(microphoneError(e));
    } finally {
      if (mounted.current) setRequesting(false);
    }
  };
  const remove = (a: Attachment) => {
    URL.revokeObjectURL(a.url);
    pendingUrls.current.delete(a.url);
    setAttachments((xs) => xs.filter((x) => x.id !== a.id));
  };
  return (
    <form
      className="shrink-0 space-y-3 border-t p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (
          (!text.trim() && !attachments.length) ||
          recording ||
          requesting ||
          !preferences.allowMessages
        )
          return;
        try {
          sendMessage(conversationId, text.trim(), attachments, reply?.id);
          attachments.forEach((a) => pendingUrls.current.delete(a.url));
          notify(
            online ? "Message saved locally" : "Message queued",
            "Demo conversation only — no real delivery.",
          );
          setText("");
          setAttachments([]);
          setError("");
          onReplySent?.();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Message could not be saved. Try again.");
        }
      }}
    >
      {reply && (
        <div className="flex items-center gap-2 border-l-2 border-accent pl-3 text-sm">
          <span className="min-w-0 flex-1 truncate">Replying to: {reply.text || "Attachment"}</span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Cancel reply"
            onClick={onReplySent}
          >
            <X />
          </Button>
        </div>
      )}
      {attachments.length > 0 && (
        <div className="grid max-h-64 gap-3 overflow-y-auto sm:grid-cols-2">
          {attachments.map((a) => (
            <div key={a.id} className="relative rounded-lg border bg-muted p-3 pr-11">
              <AttachmentPreview attachment={a} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0"
                aria-label={`Remove ${a.name}`}
                onClick={() => remove(a)}
              >
                <X />
              </Button>
            </div>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!preferences.allowMessages && (
        <p className="text-sm text-warning">Messaging is disabled in your privacy settings.</p>
      )}
      {recording && (
        <div className="flex items-center gap-2 text-sm text-destructive" role="status">
          <Mic className="h-4 w-4 animate-pulse" />
          Recording · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          <Button
            variant="destructive"
            type="button"
            size="sm"
            onClick={() => recorder.current?.stop()}
          >
            <Square />
            Stop
          </Button>
        </div>
      )}
      <div className="flex min-w-0 items-center gap-1.5">
        <input
          ref={picker}
          type="file"
          multiple
          className="sr-only"
          aria-label="Attach files"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={videoPicker}
          type="file"
          accept="video/*"
          className="sr-only"
          aria-label="Attach video"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Attach files"
          aria-label="Choose files"
          disabled={recording || requesting || !preferences.allowMessages}
          onClick={() => picker.current?.click()}
        >
          <Paperclip />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Choose phone video"
          aria-label="Choose video"
          disabled={recording || requesting || !preferences.allowMessages}
          onClick={() => videoPicker.current?.click()}
        >
          <Video />
        </Button>
        <label htmlFor="msg" className="sr-only">
          Message
        </label>
        <input
          id="msg"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message…"
          className="min-w-0 flex-1 rounded-full border bg-background px-3 py-2 text-sm"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Record voice message"
          aria-label="Record voice message"
          disabled={recording || requesting || !preferences.allowMessages}
          onClick={record}
        >
          <Mic />
        </Button>
        <Button
          aria-label="Send"
          size="icon"
          className="shrink-0 rounded-full bg-brand"
          disabled={
            (!text.trim() && !attachments.length) ||
            recording ||
            requesting ||
            !preferences.allowMessages
          }
        >
          <Send />
        </Button>
      </div>
      {requesting && (
        <p role="status" className="text-xs text-muted-foreground">
          Waiting for microphone permission…
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Sign in to enable real delivery · attachments require an authenticated account
      </p>
    </form>
  );
}
