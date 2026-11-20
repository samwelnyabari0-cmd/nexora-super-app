import { describe, expect, it } from "vitest";
import {
  nextCameraFacingMode,
  setMediaTracksEnabled,
  supportsCameraFacingMode,
} from "./call-media";

describe("call media controls", () => {
  it("enables and disables only the supplied media tracks", () => {
    const audio = { enabled: true };
    const video = { enabled: true };
    setMediaTracksEnabled([audio, video], false);
    expect(audio.enabled).toBe(false);
    expect(video.enabled).toBe(false);
    setMediaTracksEnabled([audio], true);
    expect(audio.enabled).toBe(true);
    expect(video.enabled).toBe(false);
  });

  it("switches between front and rear camera modes", () => {
    expect(nextCameraFacingMode("user")).toBe("environment");
    expect(nextCameraFacingMode("environment")).toBe("user");
  });

  it("honours device-reported camera capabilities", () => {
    expect(supportsCameraFacingMode(["user", "environment"], "environment")).toBe(true);
    expect(supportsCameraFacingMode(["user"], "environment")).toBe(false);
    expect(supportsCameraFacingMode(undefined, "environment")).toBe(true);
  });
});
