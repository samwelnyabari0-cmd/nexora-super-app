import { useRef } from "react";
import { Move, ZoomIn } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  MEDIA_FRAME_RATIOS,
  getFrameAspectRatio,
  normalizeMediaFraming,
  type MediaFrameRatio,
} from "@/lib/media-framing";

type Props = {
  src: string;
  mediaType?: string;
  originalAspectRatio: number | null;
  frameRatio: MediaFrameRatio;
  focalX: number;
  focalY: number;
  zoom: number;
  onFrameRatioChange: (value: MediaFrameRatio) => void;
  onFramingChange: (value: { focalX: number; focalY: number; zoom: number }) => void;
};

export function MediaFramingEditor({
  src, mediaType, originalAspectRatio, frameRatio, focalX, focalY, zoom,
  onFrameRatioChange, onFramingChange,
}: Props) {
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragStart = useRef<{ x: number; y: number; focalX: number; focalY: number } | null>(null);
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);
  const framing = normalizeMediaFraming({ focalX, focalY, zoom });
  const aspectRatio = getFrameAspectRatio(frameRatio, originalAspectRatio);
  const cropped = frameRatio !== "original";

  const distance = (points: { x: number; y: number }[]) =>
    Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      dragStart.current = { x: event.clientX, y: event.clientY, focalX: framing.focalX, focalY: framing.focalY };
    } else if (pointers.current.size === 2) {
      pinchStart.current = { distance: distance([...pointers.current.values()]), zoom: framing.zoom };
      dragStart.current = null;
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];
    if (points.length >= 2 && pinchStart.current) {
      const nextZoom = pinchStart.current.zoom * distance(points) / Math.max(1, pinchStart.current.distance);
      onFramingChange(normalizeMediaFraming({ ...framing, zoom: nextZoom }));
      return;
    }
    if (dragStart.current && cropped) {
      const rect = event.currentTarget.getBoundingClientRect();
      const nextX = dragStart.current.focalX - ((event.clientX - dragStart.current.x) / Math.max(1, rect.width)) * 100;
      const nextY = dragStart.current.focalY - ((event.clientY - dragStart.current.y) / Math.max(1, rect.height)) * 100;
      onFramingChange(normalizeMediaFraming({ ...framing, focalX: nextX, focalY: nextY }));
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    pinchStart.current = null;
    dragStart.current = null;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Frame your media</h3>
          <p className="text-xs text-muted-foreground">Drag to reposition. Pinch or use the slider to zoom.</p>
        </div>
        <Move className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Media aspect ratio">
        {MEDIA_FRAME_RATIOS.map((frame) => (
          <Button key={frame.value} type="button" size="sm"
            variant={frameRatio === frame.value ? "default" : "outline"}
            aria-pressed={frameRatio === frame.value}
            onClick={() => onFrameRatioChange(frame.value)}>
            {frame.label}
          </Button>
        ))}
      </div>
      <div className="mx-auto w-full max-w-sm overflow-hidden rounded-xl bg-neutral-950 p-3">
        <div
          className="relative mx-auto max-h-[52svh] w-full touch-none overflow-hidden rounded-lg bg-black"
          style={{ aspectRatio, maxWidth: aspectRatio > 1 ? "100%" : "min(100%, 320px)" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {mediaType?.startsWith("video/") ? (
            <video src={src} autoPlay muted loop playsInline preload="metadata"
              className="h-full w-full select-none"
              style={{
                objectFit: cropped ? "cover" : "contain",
                objectPosition: framing.focalX + "% " + framing.focalY + "%",
                transform: "scale(" + framing.zoom + ")",
              }} />
          ) : (
            <img src={src} alt="Media framing preview" draggable={false}
              className="h-full w-full select-none"
              style={{
                objectFit: cropped ? "cover" : "contain",
                objectPosition: framing.focalX + "% " + framing.focalY + "%",
                transform: "scale(" + framing.zoom + ")",
              }} />
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Slider min={1} max={3} step={0.05} value={[framing.zoom]}
          onValueChange={(value) => onFramingChange(normalizeMediaFraming({ ...framing, zoom: value[0] }))} />
        <span className="w-10 text-right text-xs tabular-nums">{framing.zoom.toFixed(1)}×</span>
      </div>
    </section>
  );
}
