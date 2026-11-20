export type CameraFacingMode = "user" | "environment";

export function setMediaTracksEnabled(
  tracks: readonly Pick<MediaStreamTrack, "enabled">[],
  enabled: boolean,
): void {
  tracks.forEach((track) => { track.enabled = enabled; });
}

export function nextCameraFacingMode(current: CameraFacingMode): CameraFacingMode {
  return current === "user" ? "environment" : "user";
}

export function supportsCameraFacingMode(
  supportedModes: readonly string[] | undefined,
  requestedMode: CameraFacingMode,
): boolean {
  return !supportedModes?.length || supportedModes.includes(requestedMode);
}
