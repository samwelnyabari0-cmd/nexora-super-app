import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

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
        onClick={() => setSpeedIndex((index) => (index + 1) % SPEEDS.length)}
        aria-label={`Playback speed ${SPEEDS[speedIndex]}x. Change speed`}
        className="rounded-md bg-background/20 px-1.5 py-1 text-[10px] font-semibold"
      >
        {SPEEDS[speedIndex]}x
      </button>
    </div>
  );
}
