import { describe, expect, it } from "vitest";
import {
  MAX_MESSAGE_TRANSCRIPTION_BYTES,
  validateTranscriptionAudio,
} from "./message-transcription";

describe("message voice transcription validation", () => {
  it("accepts non-empty audio up to the server's 20 MiB limit", () => {
    expect(validateTranscriptionAudio(1, "audio/webm")).toEqual({ ok: true });
    expect(validateTranscriptionAudio(MAX_MESSAGE_TRANSCRIPTION_BYTES, "audio/mp4")).toEqual({ ok: true });
  });

  it("rejects empty, oversized, and non-audio content before upload", () => {
    expect(validateTranscriptionAudio(0, "audio/webm").ok).toBe(false);
    expect(validateTranscriptionAudio(MAX_MESSAGE_TRANSCRIPTION_BYTES + 1, "audio/webm").ok).toBe(false);
    expect(validateTranscriptionAudio(100, "application/pdf").ok).toBe(false);
  });
});
