import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { aiTranscribe } from "@/lib/ai.functions";
import { validateTranscriptionAudio } from "./message-transcription";

type TranscribeVoiceMessageButtonProps = {
  src: string;
};

export function TranscribeVoiceMessageButton({ src }: TranscribeVoiceMessageButtonProps) {
  const runTranscription = useServerFn(aiTranscribe);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");

  async function transcribe() {
    if (!src || busy) return;
    setBusy(true);
    setError("");
    setTranscript("");
    setSummary("");
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error("The voice message could not be downloaded.");
      const blob = await response.blob();
      const mimeType = blob.type || "audio/webm";
      const validation = validateTranscriptionAudio(blob.size, mimeType);
      if (!validation.ok) throw new Error(validation.reason);

      const extension = mimeType.includes("mp4") ? "m4a" : "webm";
      const form = new FormData();
      form.append("file", new File([blob], `voice-message.${extension}`, { type: mimeType }));
      const result = await runTranscription({ data: form });
      if (result.error) throw new Error(result.error);
      setTranscript(result.transcript);
      setSummary(result.summary);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Transcription failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <p className="text-[10px] text-muted-foreground">
        Optional AI transcription sends this voice note to NEXORA's configured AI provider only when you tap.
      </p>
      <Button type="button" size="sm" variant="outline" disabled={busy || !src} onClick={() => void transcribe()}>
        {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1 h-3.5 w-3.5" />}
        {busy ? "Transcribing…" : "Transcribe"}
      </Button>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {transcript && (
        <div className="rounded-lg border bg-background/40 p-2 text-xs">
          <p className="mb-1 font-semibold">Transcript</p>
          <p className="whitespace-pre-wrap">{transcript}</p>
          {summary && (
            <>
              <p className="mb-1 mt-2 font-semibold">Summary</p>
              <p className="whitespace-pre-wrap text-muted-foreground">{summary}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
