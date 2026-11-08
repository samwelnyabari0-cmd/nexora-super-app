import { useEffect, useRef, useState } from "react";
import { Camera, Circle, Square, SwitchCamera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fileError, microphoneError } from "@/features/core/tools";

export function StudioCapture({
  onCapture,
  onError,
}: {
  onCapture: (url: string, type: string) => void;
  onError: (message: string) => void;
}) {
  const [stream, setStream] = useState<MediaStream>();
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const recorder = useRef<MediaRecorder | undefined>(undefined);
  const tracks = useRef<MediaStream | undefined>(undefined);
  const facing = useRef<"user" | "environment">("user");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      tracks.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    if (video.current && stream) video.current.srcObject = stream;
  }, [stream]);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);
  const close = () => {
    tracks.current?.getTracks().forEach((t) => t.stop());
    tracks.current = undefined;
    setStream(undefined);
  };
  const open = async () => {
    onError("");
    setBusy(true);
    tracks.current?.getTracks().forEach((t) => t.stop());
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
      const next = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing.current },
      });
      if (!mounted.current) {
        next.getTracks().forEach((t) => t.stop());
        return;
      }
      tracks.current = next;
      setStream(next);
    } catch (e) {
      onError(
        e instanceof Error && e.message === "unsupported"
          ? "Camera unavailable. Open over HTTPS in Safari or Chrome, or upload media."
          : microphoneError(e)
              .replaceAll("microphone", "camera")
              .replaceAll("Microphone", "Camera")
              .replaceAll("audio file", "photo or video"),
      );
      setStream(undefined);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const photo = () => {
    const v = video.current;
    if (!v?.videoWidth) {
      onError("Camera is still starting. Try again in a moment.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    onCapture(canvas.toDataURL("image/jpeg"), "image/jpeg");
    close();
  };
  const record = () => {
    if (!stream || typeof MediaRecorder === "undefined") {
      onError("Video recording is unavailable. Capture a photo or upload a video instead.");
      return;
    }
    try {
      const mime = ["video/webm;codecs=vp8", "video/mp4", "video/webm"].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorder.current = r;
      const chunks: BlobPart[] = [];
      let failed = false;
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onerror = () => {
        failed = true;
        onError("Video recording failed. Try again or upload a video.");
        setRecording(false);
        close();
      };
      r.onstop = () => {
        if (!mounted.current) return;
        setRecording(false);
        recorder.current = undefined;
        if (failed) return;
        const blob = new Blob(chunks, { type: r.mimeType || "video/webm" });
        const problem = fileError({ size: blob.size, name: "Camera clip" });
        if (problem) {
          onError(problem);
          return;
        }
        onCapture(URL.createObjectURL(blob), blob.type);
        close();
      };
      r.start();
      setSeconds(0);
      setRecording(true);
    } catch {
      onError("Video recording could not start. Try uploading a video.");
    }
  };
  return (
    <section className="space-y-3">
      {stream && (
        <video
          ref={video}
          autoPlay
          playsInline
          muted
          className="aspect-video w-full rounded-xl bg-muted object-contain"
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" disabled={busy || recording} onClick={open}>
          <Camera />
          {busy ? "Waiting for camera…" : stream ? "Restart camera" : "Open camera"}
        </Button>
        {stream && (
          <>
            {!recording && (
              <>
                <Button variant="outline" onClick={photo}>
                  <Camera />
                  Capture photo
                </Button>
                <Button variant="outline" onClick={record}>
                  <Circle />
                  Record clip
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Switch camera"
                  aria-label="Switch camera"
                  onClick={() => {
                    facing.current = facing.current === "user" ? "environment" : "user";
                    void open();
                  }}
                >
                  <SwitchCamera />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Close camera"
                  aria-label="Close camera"
                  onClick={close}
                >
                  <X />
                </Button>
              </>
            )}
            {recording && (
              <>
                <span role="status" className="text-sm text-destructive">
                  Recording · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
                </span>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (recorder.current?.state === "recording") recorder.current.stop();
                  }}
                >
                  <Square />
                  Stop recording
                </Button>
              </>
            )}
          </>
        )}
      </div>
      {stream && (
        <p className="text-xs text-muted-foreground">
          Camera clips are silent. Voice messages are available in Messages.
        </p>
      )}
    </section>
  );
}
