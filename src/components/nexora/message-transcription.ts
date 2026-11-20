export const MAX_MESSAGE_TRANSCRIPTION_BYTES = 20 * 1024 * 1024;

export function validateTranscriptionAudio(_size: number, _mimeType: string) {
  return { ok: false as const, reason: "Audio transcription is unavailable." };
}
