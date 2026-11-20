export const MAX_MESSAGE_TRANSCRIPTION_BYTES = 20 * 1024 * 1024;

export function validateTranscriptionAudio(size: number, mimeType: string):
  | { ok: true }
  | { ok: false; reason: string } {
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, reason: "This voice message is empty." };
  }
  if (size > MAX_MESSAGE_TRANSCRIPTION_BYTES) {
    return { ok: false, reason: "Audio must be 20 MB or smaller to transcribe." };
  }
  if (!mimeType.toLowerCase().startsWith("audio/")) {
    return { ok: false, reason: "This message is not a supported audio file." };
  }
  return { ok: true };
}
