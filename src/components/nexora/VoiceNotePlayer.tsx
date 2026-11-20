import { useEffect, useRef, useState } from "react";
import { Pause, Play, Captions, Loader2 } from "lucide-react";
import { aiTranscribe } from "@/lib/ai.functions";

type VoiceNotePlayerProps = {
  src: string;
  mine?: boolean;
};

const SPEEDS = [1, 1.5, 2] as const;
const WAVEFORM = [32, 55, 76, 44, 88, 62, 38, 72, 94, 50, 68, 35, 82, 58, 42, 74, 90, 48, 64, 36, 78, 54, 86, 45];

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function VoiceNotePlayer({ src, mine = false }: VoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playError, setPlayError] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [transcribeError, setTranscribeError] = useState("");

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = SPEEDS[speedIndex];
  }, [speedIndex]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    setPlayError(false);
    if (audio.paused) {
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setPlayError(true);
        setPlaying(false);
      }
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  async function transcribeVoiceNote() {
    if (transcribing) return;
    setTranscribing(true);
    setTranscribeError("");
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error("The voice message could not be downloaded for transcription.");
      const blob = await response.blob();
      if (!blob.size) throw new Error("This voice message is empty.");
      if (blob.size > 20 * 1024 * 1024) throw new Error("Voice messages over 20 MB cannot be transcribed.");
      const extension = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : blob.type.includes("mpeg") ? "mp3" : "webm";
      const formData = new FormData();
      formData.append("file", new File([blob], `voice-message.${extension}`, { type: blob.type || "audio/webm" }));
      const result = await aiTranscribe({ data: formData });
      if (result.error) throw new Error(result.error);
      setTranscript(result.transcript);
      setSummary(result.summary);
    } catch (caught) {
      setTranscribeError(caught instanceof Error ? caught.message : "Voice transcription is unavailable.");
    } finally {
      setTranscribing(false);
    }
  }

  return (
    <div className="flex min-w-[210px] max-w-[280px] items-center gap-2.5 py-1">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />
      <button
        type="button"
        onClick={() => void togglePlayback()}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary transition hover:bg-primary/25"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className="flex h-7 items-center gap-[3px]"
          role="img"
          aria-label={`Voice message waveform, ${Math.round(progress)} percent played`}
        >
          {WAVEFORM.map((height, index) => (
            <span
              key={index}
              className={`w-[3px] flex-1 rounded-full ${(index / WAVEFORM.length) * 100 <= progress ? "bg-primary" : mine ? "bg-primary-foreground/45" : "bg-muted-foreground/45"}`}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-[10px] opacity-75">
          <span>{formatDuration(currentTime)} / {formatDuration(duration)}</span>
          {playError && <span role="alert">Can't play audio</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => void transcribeVoiceNote()}
        disabled={transcribing}
        aria-label="Transcribe and summarize voice message"
        className="flex shrink-0 items-center gap-1 rounded-md bg-background/20 px-1.5 py-1 text-[10px] font-semibold disabled:opacity-50"
      >
        {transcribing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Captions className="h-3 w-3" />}
        {transcribing ? "…" : "Text"}
      </button>
      <button
        type="button"
        onClick={() => setSpeedIndex((index) => (index + 1) % SPEEDS.length)}
        aria-label={`Playback speed ${SPEEDS[speedIndex]}x. Change speed`}
        className="rounded-md bg-background/20 px-1.5 py-1 text-[10px] font-semibold"
      >
        {SPEEDS[speedIndex]}x
      </button>
    </div>
    {transcribeError && <p role="alert" className="max-w-[280px] text-[10px] text-destructive">{transcribeError}</p>}
    {transcript && (
      <details className="max-w-[280px] rounded-lg border border-current/10 p-2 text-xs">
        <summary className="cursor-pointer font-medium">Transcript and summary</summary>
        <p className="mt-2 whitespace-pre-wrap">{transcript}</p>
        {summary && <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{summary}</p>}
      </details>
    )}
  );
}
