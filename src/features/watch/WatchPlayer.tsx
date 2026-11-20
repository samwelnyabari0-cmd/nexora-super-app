import { useCallback, useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import { X, AlertCircle, Settings2 } from "lucide-react";
import { saveWatchProgress } from "./data";

type WatchPlayerProps = {
  titleId: string;
  title: string;
  manifestUrl: string;
  userId?: string;
  initialProgress?: number;
  onClose: () => void;
};

export function WatchPlayer({
  titleId,
  title,
  manifestUrl,
  userId,
  initialProgress = 0,
  onClose,
}: WatchPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const lastSavedRef = useRef(0);
  const [error, setError] = useState("");
  const [levels, setLevels] = useState<Array<{ height: number; bitrate: number }>>([]);
  const [quality, setQuality] = useState(-1);

  const saveProgress = useCallback(async (video: HTMLVideoElement) => {
    if (!userId || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const position = Math.floor(video.currentTime);
    if (Math.abs(position - lastSavedRef.current) < 3 && position < video.duration - 2) return;
    lastSavedRef.current = position;
    const result = await saveWatchProgress({
      userId,
      titleId,
      progressSeconds: position,
      totalSeconds: Math.floor(video.duration),
    });
    if (result.error) setError("Playback continues, but progress could not sync.");
  }, [titleId, userId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;

    const start = async () => {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = manifestUrl;
      } else {
        const module = await import("hls.js");
        if (cancelled) return;
        const HlsEngine = module.default;
        if (!HlsEngine.isSupported()) {
          setError("HLS playback is not supported by this browser.");
          return;
        }
        const hls = new HlsEngine({ enableWorker: true, capLevelToPlayerSize: true });
        hlsRef.current = hls;
        hls.on(HlsEngine.Events.MANIFEST_PARSED, () => {
          setLevels(hls.levels.map((level) => ({ height: level.height, bitrate: level.bitrate })));
        });
        hls.on(HlsEngine.Events.ERROR, (_event, data) => {
          if (data.fatal) setError("This stream could not be loaded. Please try again later.");
        });
        hls.loadSource(manifestUrl);
        hls.attachMedia(video);
      }
    };

    void start().catch(() => setError("The video player could not be initialized."));
    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [manifestUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const resume = () => {
      if (initialProgress > 0 && initialProgress < video.duration - 5) {
        video.currentTime = initialProgress;
      }
    };
    video.addEventListener("loadedmetadata", resume);
    return () => video.removeEventListener("loadedmetadata", resume);
  }, [initialProgress]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !userId) return;
    const timer = window.setInterval(() => {
      if (!video.paused && !video.ended) void saveProgress(video);
    }, 12_000);
    const save = () => void saveProgress(video);
    video.addEventListener("pause", save);
    video.addEventListener("ended", save);
    return () => {
      window.clearInterval(timer);
      video.removeEventListener("pause", save);
      video.removeEventListener("ended", save);
    };
  }, [saveProgress, userId]);

  useEffect(() => {
    if (hlsRef.current) hlsRef.current.currentLevel = quality;
  }, [quality]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-5xl">
        <div className="mb-3 flex items-center justify-between gap-3 text-white">
          <h2 className="truncate text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full bg-white/10 p-2" aria-label="Close player"><X className="h-5 w-5" /></button>
        </div>
        <video ref={videoRef} controls playsInline className="max-h-[75vh] w-full rounded-xl bg-black" />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-white/80">
          <span>Adaptive streaming</span>
          {levels.length > 0 && (
            <label className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Quality
              <select value={quality} onChange={(event) => setQuality(Number(event.target.value))} className="rounded-md border border-white/20 bg-neutral-900 px-2 py-1 text-white">
                <option value={-1}>Auto</option>
                {levels.map((level, index) => <option key={index} value={index}>{level.height}p</option>)}
              </select>
            </label>
          )}
        </div>
        {error && <p className="mt-3 flex items-center gap-2 text-sm text-amber-300"><AlertCircle className="h-4 w-4" />{error}</p>}
      </div>
    </div>
  );
}
