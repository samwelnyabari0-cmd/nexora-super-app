import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  Mic,
  Pause,
  Play,
  Scissors,
  Sliders,
  Sparkles,
  Sticker,
  Type,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  videoSrc: string;
  onExported: (file: Blob) => void;
};

type EditorTab = "trim" | "filters" | "audio" | "branding";

const FILTERS: Record<string, (intensity: number) => string> = {
  original: () => "none",
  vivid: (value) => `saturate(${1 + value * 0.8}) contrast(${1 + value * 0.3})`,
  cinema: (value) => `contrast(${1 + value * 0.4}) sepia(${value * 0.35})`,
  mono: (value) => `grayscale(${value}) contrast(${1 + value * 0.2})`,
  soft: (value) => `brightness(${1 + value * 0.15}) contrast(${1 - value * 0.15}) blur(${value * 0.5}px)`,
};

function supportedWebmType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

export default function AdvancedVideoStudioEditor({ videoSrc, onExported }: Props) {
  const previewRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micChunksRef = useRef<Blob[]>([]);
  const musicUrlRef = useRef<string | null>(null);
  const voiceUrlRef = useRef<string | null>(null);
  const exportedUrlRef = useRef<string | null>(null);

  const [tab, setTab] = useState<EditorTab>("trim");
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [filter, setFilter] = useState("vivid");
  const [intensity, setIntensity] = useState(0.8);
  const [videoVolume, setVideoVolume] = useState(1);
  const [musicVolume, setMusicVolume] = useState(0.35);
  const [musicUrl, setMusicUrl] = useState("");
  const [voiceUrl, setVoiceUrl] = useState("");
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [overlayText, setOverlayText] = useState("@yourusername");
  const [position, setPosition] = useState<"top-left" | "top-right" | "bottom-left" | "bottom-right">("bottom-right");
  const [sticker, setSticker] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportedUrl, setExportedUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const video = previewRef.current;
    if (!video) return;
    const loaded = () => {
      const length = Number.isFinite(video.duration) ? video.duration : 0;
      setDuration(length);
      setStart(0);
      setEnd(length);
    };
    video.addEventListener("loadedmetadata", loaded);
    if (video.readyState >= 1) loaded();
    return () => video.removeEventListener("loadedmetadata", loaded);
  }, [videoSrc]);

  useEffect(() => () => {
    if (musicUrlRef.current) URL.revokeObjectURL(musicUrlRef.current);
    if (voiceUrlRef.current) URL.revokeObjectURL(voiceUrlRef.current);
    if (exportedUrlRef.current) URL.revokeObjectURL(exportedUrlRef.current);
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  function chooseMusic(file?: File) {
    if (!file) return;
    if (musicUrlRef.current) URL.revokeObjectURL(musicUrlRef.current);
    const nextUrl = URL.createObjectURL(file);
    musicUrlRef.current = nextUrl;
    setMusicUrl(nextUrl);
    setError("");
  }

  async function startVoiceRecording() {
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Voice recording is not supported in this browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      micChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size) micChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(micChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (voiceUrlRef.current) URL.revokeObjectURL(voiceUrlRef.current);
        const nextUrl = URL.createObjectURL(blob);
        voiceUrlRef.current = nextUrl;
        setVoiceUrl(nextUrl);
        stream.getTracks().forEach((track) => track.stop());
        micStreamRef.current = null;
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecordingVoice(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Microphone access was unavailable.");
    }
  }

  function stopVoiceRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecordingVoice(false);
  }

  async function exportVideo() {
    const mimeType = supportedWebmType();
    if (!mimeType) {
      setError("This browser cannot export video. Please use the latest Chrome browser on Android or desktop.");
      return;
    }
    if (!Number.isFinite(end) || end <= start || end - start < 0.25) {
      setError("Choose a valid trim range of at least 0.25 seconds.");
      return;
    }

    setExporting(true);
    setError("");
    let audioContext: AudioContext | null = null;
    let canvasStream: MediaStream | null = null;
    let outputStream: MediaStream | null = null;
    let renderVideo: HTMLVideoElement | null = null;
    let musicAudio: HTMLAudioElement | null = null;
    let voiceAudio: HTMLAudioElement | null = null;
    let animationFrame = 0;
    let recorder: MediaRecorder | null = null;

    try {
      const canvas = document.createElement("canvas");
      renderVideo = document.createElement("video");
      renderVideo.src = videoSrc;
      renderVideo.preload = "auto";
      renderVideo.playsInline = true;
      renderVideo.muted = false;

      await new Promise<void>((resolve, reject) => {
        if (!renderVideo) return reject(new Error("Video could not be opened."));
        renderVideo.onloadedmetadata = () => resolve();
        renderVideo.onerror = () => reject(new Error("The selected video could not be decoded."));
        renderVideo.load();
      });

      const sourceWidth = renderVideo.videoWidth || 1280;
      const sourceHeight = renderVideo.videoHeight || 720;
      const scale = Math.min(1, 1280 / sourceWidth, 720 / sourceHeight);
      canvas.width = Math.max(2, Math.floor(sourceWidth * scale));
      canvas.height = Math.max(2, Math.floor(sourceHeight * scale));
      const context = canvas.getContext("2d");
      if (!context || typeof canvas.captureStream !== "function") {
        throw new Error("Canvas video export is not supported by this browser.");
      }

      audioContext = new AudioContext();
      const mix = audioContext.createMediaStreamDestination();
      const videoSource = audioContext.createMediaElementSource(renderVideo);
      const originalGain = audioContext.createGain();
      originalGain.gain.value = videoVolume;
      videoSource.connect(originalGain);
      originalGain.connect(mix);

      if (musicUrl) {
        musicAudio = new Audio(musicUrl);
        musicAudio.loop = true;
        const musicSource = audioContext.createMediaElementSource(musicAudio);
        const musicGain = audioContext.createGain();
        musicGain.gain.value = musicVolume;
        musicSource.connect(musicGain);
        musicGain.connect(mix);
      }

      if (voiceUrl) {
        voiceAudio = new Audio(voiceUrl);
        const voiceSource = audioContext.createMediaElementSource(voiceAudio);
        voiceSource.connect(mix);
      }

      canvasStream = canvas.captureStream(30);
      outputStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...mix.stream.getAudioTracks(),
      ]);
      recorder = new MediaRecorder(outputStream, { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };

      const stopped = new Promise<void>((resolve, reject) => {
        if (!recorder) return reject(new Error("Video recorder could not start."));
        recorder.onstop = () => resolve();
        recorder.onerror = () => reject(new Error("Video export failed while recording."));
      });

      const drawFrame = () => {
        if (!context || !renderVideo) return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.filter = FILTERS[filter]?.(intensity) ?? "none";
        context.drawImage(renderVideo, 0, 0, canvas.width, canvas.height);
        context.filter = "none";

        if (overlayText.trim()) {
          const padding = Math.max(18, Math.round(canvas.width * 0.025));
          const fontSize = Math.max(18, Math.round(canvas.width * 0.035));
          context.font = `bold ${fontSize}px Arial, sans-serif`;
          context.textBaseline = "middle";
          const textWidth = context.measureText(overlayText).width;
          const left = position.endsWith("left") ? padding : canvas.width - textWidth - padding * 2;
          const top = position.startsWith("top") ? padding : canvas.height - fontSize - padding * 2;
          context.fillStyle = "rgba(0,0,0,0.58)";
          context.fillRect(left - padding / 2, top - padding / 2, textWidth + padding, fontSize + padding);
          context.fillStyle = "#ffffff";
          context.fillText(overlayText, left, top + fontSize / 2);
        }
        if (sticker) {
          context.font = `${Math.round(canvas.width * 0.09)}px sans-serif`;
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(sticker, canvas.width / 2, canvas.height / 2);
          context.textAlign = "start";
        }
        if (renderVideo.currentTime >= end || renderVideo.ended) {
          if (recorder?.state === "recording") recorder.stop();
          renderVideo.pause();
          musicAudio?.pause();
          voiceAudio?.pause();
          cancelAnimationFrame(animationFrame);
          return;
        }
        animationFrame = requestAnimationFrame(drawFrame);
      };

      await new Promise<void>((resolve) => {
        if (!renderVideo || start <= 0.01) return resolve();
        renderVideo.addEventListener("seeked", () => resolve(), { once: true });
        renderVideo.currentTime = start;
      });
      await audioContext.resume();
      recorder.start(250);
      await renderVideo.play();
      if (musicAudio) await musicAudio.play().catch(() => undefined);
      if (voiceAudio) await voiceAudio.play().catch(() => undefined);
      drawFrame();
      await stopped;

      const output = new Blob(chunks, { type: recorder.mimeType || mimeType });
      if (!output.size) throw new Error("The exported video was empty. Please try again.");
      const nextUrl = URL.createObjectURL(output);
      setExportedUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        exportedUrlRef.current = nextUrl;
        return nextUrl;
      });
      onExported(output);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not export this video.");
    } finally {
      if (recorder?.state === "recording") recorder.stop();
      cancelAnimationFrame(animationFrame);
      renderVideo?.pause();
      musicAudio?.pause();
      voiceAudio?.pause();
      outputStream?.getTracks().forEach((track) => track.stop());
      canvasStream?.getTracks().forEach((track) => track.stop());
      if (audioContext && audioContext.state !== "closed") await audioContext.close().catch(() => undefined);
      setExporting(false);
    }
  }

  const previewFilter = FILTERS[filter]?.(intensity) ?? "none";

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold"><Sparkles className="h-4 w-4 text-primary" /> Advanced video editor</h2>
          <p className="text-xs text-muted-foreground">Edits are rendered into a new downloadable video.</p>
        </div>
        <span className="rounded-full border px-2 py-1 text-[10px] font-semibold">STUDIO</span>
      </div>

      <div className="relative overflow-hidden rounded-xl bg-black">
        <video ref={previewRef} src={videoSrc} controls playsInline className="max-h-[55dvh] w-full object-contain" style={{ filter: previewFilter }} />
        {overlayText.trim() && (
          <span className={`pointer-events-none absolute rounded bg-black/60 px-2 py-1 text-xs font-bold text-white ${
            position === "top-left" ? "left-3 top-3" :
            position === "top-right" ? "right-3 top-3" :
            position === "bottom-left" ? "bottom-3 left-3" : "bottom-3 right-3"
          }`}>{overlayText}</span>
        )}
        {sticker && <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl">{sticker}</span>}
      </div>

      <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1">
        {([
          ["trim", "Trim", Scissors],
          ["filters", "Filters", Sliders],
          ["audio", "Audio", Volume2],
          ["branding", "Brand", Type],
        ] as const).map(([key, label, Icon]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-lg px-1 py-2 text-xs font-semibold ${tab === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
            <Icon className="mx-auto mb-1 h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {tab === "trim" && (
        <div className="space-y-3 rounded-xl bg-muted/40 p-3">
          <div className="flex justify-between text-xs"><span>Start: {start.toFixed(1)}s</span><span>End: {end.toFixed(1)}s</span></div>
          <label className="block text-xs">Trim start
            <input aria-label="Trim start" type="range" min="0" max={Math.max(0, end - 0.25)} step="0.1" value={start} onChange={(event) => setStart(Number(event.target.value))} className="mt-2 w-full accent-primary" />
          </label>
          <label className="block text-xs">Trim end
            <input aria-label="Trim end" type="range" min={Math.min(duration, start + 0.25)} max={Math.max(duration, 0.25)} step="0.1" value={Math.min(end, Math.max(duration, 0.25))} onChange={(event) => setEnd(Number(event.target.value))} className="mt-2 w-full accent-primary" />
          </label>
          <p className="text-xs text-muted-foreground">Selected length: {Math.max(0, end - start).toFixed(1)} seconds</p>
        </div>
      )}

      {tab === "filters" && (
        <div className="space-y-3 rounded-xl bg-muted/40 p-3">
          <div className="flex flex-wrap gap-2">
            {Object.keys(FILTERS).map((name) => <Button key={name} type="button" size="sm" variant={filter === name ? "default" : "outline"} className="capitalize" onClick={() => setFilter(name)}>{name}</Button>)}
          </div>
          <label className="block text-xs">Filter intensity: {Math.round(intensity * 100)}%
            <input aria-label="Filter intensity" type="range" min="0" max="100" value={Math.round(intensity * 100)} onChange={(event) => setIntensity(Number(event.target.value) / 100)} className="mt-2 w-full accent-primary" />
          </label>
        </div>
      )}

      {tab === "audio" && (
        <div className="space-y-4 rounded-xl bg-muted/40 p-3">
          <label className="block text-xs">Original audio: {Math.round(videoVolume * 100)}%
            <input aria-label="Original audio volume" type="range" min="0" max="100" value={Math.round(videoVolume * 100)} onChange={(event) => setVideoVolume(Number(event.target.value) / 100)} className="mt-2 w-full accent-primary" />
          </label>
          <label className="block text-xs">Background music volume: {Math.round(musicVolume * 100)}%
            <input aria-label="Background music volume" type="range" min="0" max="100" value={Math.round(musicVolume * 100)} onChange={(event) => setMusicVolume(Number(event.target.value) / 100)} className="mt-2 w-full accent-primary" />
          </label>
          <label className="block cursor-pointer rounded-lg border bg-background p-3 text-center text-xs font-semibold">
            Choose background music
            <input type="file" accept="audio/*" className="sr-only" onChange={(event) => chooseMusic(event.target.files?.[0])} />
          </label>
          {musicUrl && <p className="text-xs text-muted-foreground">Background music selected.</p>}
          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <span className="flex items-center gap-2 text-xs"><Mic className="h-4 w-4" /> Voiceover</span>
            <Button type="button" size="sm" variant={recordingVoice ? "destructive" : "outline"} onClick={() => recordingVoice ? stopVoiceRecording() : void startVoiceRecording()}>
              {recordingVoice ? <><Pause className="mr-1 h-3 w-3" /> Stop recording</> : <><Play className="mr-1 h-3 w-3" /> Record voice</>}
            </Button>
          </div>
          {voiceUrl && <audio controls src={voiceUrl} className="w-full" />}
        </div>
      )}

      {tab === "branding" && (
        <div className="space-y-3 rounded-xl bg-muted/40 p-3">
          <label className="block text-xs">Text or watermark
            <input aria-label="Branding text" value={overlayText} onChange={(event) => setOverlayText(event.target.value)} maxLength={80} className="mt-2 w-full rounded-lg border bg-background p-2 text-sm" placeholder="@yourusername" />
          </label>
          <label className="block text-xs">Text position
            <select aria-label="Branding position" value={position} onChange={(event) => setPosition(event.target.value as typeof position)} className="mt-2 w-full rounded-lg border bg-background p-2">
              <option value="top-left">Top left</option><option value="top-right">Top right</option><option value="bottom-left">Bottom left</option><option value="bottom-right">Bottom right</option>
            </select>
          </label>
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs"><Sticker className="h-4 w-4" /> Sticker</p>
            <div className="flex flex-wrap gap-2">{["🔥", "❤️", "😂", "⭐", "🚀", "👏", "✨"].map((item) => <button key={item} type="button" aria-label={`Sticker ${item}`} aria-pressed={sticker === item} onClick={() => setSticker(sticker === item ? "" : item)} className={`rounded-lg p-2 text-xl ${sticker === item ? "bg-primary/20 ring-1 ring-primary" : "bg-background"}`}>{item}</button>)}</div>
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {exporting && <p role="status" className="text-xs text-muted-foreground">Rendering your video in real time. Keep this page open until export finishes.</p>}
      <Button type="button" className="w-full" disabled={exporting || !duration} onClick={() => void exportVideo()}>
        <CheckCircle2 className="mr-2 h-4 w-4" />{exporting ? "Exporting video…" : "Export edited video"}
      </Button>
      {exportedUrl && (
        <a href={exportedUrl} download="nexora-edited-video.webm" className="flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold text-primary">
          <Download className="h-4 w-4" /> Download edited video
        </a>
      )}
      <p className="text-[11px] text-muted-foreground">Exports as WebM. The original upload stays available until you choose to publish the edited copy.</p>
    </section>
  );
}
