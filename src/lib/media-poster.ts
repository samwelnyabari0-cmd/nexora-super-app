export type GeneratedMediaPoster = {
  blob: Blob;
  width: number;
  height: number;
  aspectRatio: number;
  dominantColor: string;
};

export function getDominantColorFromPixels(data: Uint8ClampedArray): string {
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let index = 0; index + 3 < data.length; index += 4) {
    const alpha = data[index + 3] / 255;
    if (alpha < 0.2) continue;
    red += data[index] * alpha;
    green += data[index + 1] * alpha;
    blue += data[index + 2] * alpha;
    count += alpha;
  }
  if (!count) return "#171717";
  const hex = (value: number) =>
    Math.round(value / count)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(red)}${hex(green)}${hex(blue)}`;
}

function loadVideoFrame(
  file: File,
): Promise<{ source: CanvasImageSource; width: number; height: number; cleanup: () => void }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    let settled = false;
    const cleanup = () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Could not read a frame from this video."));
    };
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      if (
        !Number.isFinite(video.videoWidth) ||
        !Number.isFinite(video.videoHeight) ||
        !video.videoWidth ||
        !video.videoHeight
      ) {
        fail();
        return;
      }
      const targetTime = Math.min(0.5, Math.max(0, (video.duration || 0) * 0.05));
      if (targetTime === 0) {
        settled = true;
        resolve({ source: video, width: video.videoWidth, height: video.videoHeight, cleanup });
      } else {
        video.onseeked = () => {
          if (settled) return;
          settled = true;
          resolve({ source: video, width: video.videoWidth, height: video.videoHeight, cleanup });
        };
        video.currentTime = targetTime;
      }
    };
    video.onerror = fail;
    video.src = url;
  });
}

export async function createMediaPoster(
  file: File,
  maxWidth = 960,
): Promise<GeneratedMediaPoster | null> {
  let source: CanvasImageSource;
  let width: number;
  let height: number;
  let cleanup: () => void = () => undefined;

  if (file.type.startsWith("image/")) {
    if (typeof createImageBitmap !== "function") return null;
    const bitmap = await createImageBitmap(file);
    source = bitmap;
    width = bitmap.width;
    height = bitmap.height;
    cleanup = () => bitmap.close();
  } else if (file.type.startsWith("video/")) {
    const frame = await loadVideoFrame(file);
    source = frame.source;
    width = frame.width;
    height = frame.height;
    cleanup = frame.cleanup;
  } else {
    return null;
  }

  try {
    if (!width || !height) return null;
    const scale = Math.min(1, maxWidth / width);
    const outputWidth = Math.max(1, Math.round(width * scale));
    const outputHeight = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(source, 0, 0, outputWidth, outputHeight);
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = 24;
    sampleCanvas.height = 24;
    const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
    if (!sampleContext) return null;
    sampleContext.drawImage(source, 0, 0, 24, 24);
    const pixels = sampleContext.getImageData(0, 0, 24, 24).data;
    const dominantColor = getDominantColorFromPixels(pixels);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.78),
    );
    if (!blob || blob.type !== "image/webp") return null;
    return {
      blob,
      width: outputWidth,
      height: outputHeight,
      aspectRatio: outputWidth / outputHeight,
      dominantColor,
    };
  } finally {
    cleanup();
  }
}
